/**
 * packages/sdk/src/schemas/proof-record.ts
 *
 * THE MOAT OBJECT. Mirrors ProofLedger (SMART-CONTRACT.md §2.2) 1:1 in
 * spirit: a decision is pre-registered on-chain BEFORE execution, and an
 * outcome is attested by the keeper AFTER the deadline, from objective
 * on-chain state — never from agent-reported values. This schema is the
 * enforcement point: a `ProofRecord` that violates pre-registration timing
 * cannot be constructed, full stop. Any future change to these invariants
 * is a new version of this schema, never a loosened `.refine` on this one
 * (CLAUDE.md §4: "intentHash/evidenceHash schemes are frozen; changes = new
 * version, not an edit").
 *
 * Note on `action`: on-chain, only `intentHash = keccak256(abi.encode(...))`
 * exists — the preimage is never stored on-chain. `action` here is the
 * off-chain-known preimage the mock/UI layer renders as plain English
 * ("Buy 12 CAKE if price ≤ $2.10"); a real client fills it from the runner's
 * own intent log, not from the chain. It is illustrative, not authoritative
 * — `intentHash` is what the ledger and the `/verify` recompute path trust.
 */
import { z } from "zod";
import {
  AgentIdSchema,
  BlockNumberSchema,
  Hex32Schema,
  IsoDatetimeSchema,
  RecordIdSchema,
  TxHashSchema,
  Usd1Schema,
  Usd1NonNegativeSchema,
} from "./primitives.js";

/** Max window between registration and self-imposed deadline (SMART-CONTRACT.md §2.3: "front-running the deadline"). */
export const MAX_DECISION_WINDOW_HOURS = 24;

/** Minimum trade size (USD1) for a record to be ranking-eligible (SMART-CONTRACT.md §2.3 anti dust-flooding). Informational here — enforcement lives in metrics derivation, not this schema. */
export const MIN_RANKING_ELIGIBLE_SIZE_USD1 = 5;

/**
 * The off-chain-known preimage of `intentHash` — what the agent *intends* to
 * do. `abi.encode(actionType, market, direction, params, sizeUsd1, nonce)`
 * per SMART-CONTRACT.md §2.2.
 */
export const ProofActionSchema = z.object({
  actionType: z.string().min(1), // e.g. "grid-band-fill", "range-recenter", "farm-rotate", "collateral-topup"
  market: z.string().min(1), // e.g. "CAKE/USDT", "Venus BNB collateral"
  direction: z.enum([
    "buy",
    "sell",
    "long",
    "short",
    "rebalance",
    "harvest",
    "protect",
    "deposit",
    "withdraw",
  ]),
  sizeUsd1: Usd1NonNegativeSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  nonce: z.number().int().nonnegative(),
  /** Plain-English rendering of the above, for the proof stream ("Buy 12 CAKE if price ≤ $2.10"). */
  plainText: z.string().min(1),
});
export type ProofAction = z.infer<typeof ProofActionSchema>;

/** Pre-execution half — registered on-chain via `registerDecision` before the action runs. */
export const ProofDecisionSchema = z.object({
  intentHash: Hex32Schema,
  action: ProofActionSchema,
  /** uint64 deadline — after this, the record resolves win/loss/neutral/expired. */
  deadline: IsoDatetimeSchema,
  registeredAt: IsoDatetimeSchema,
  registeredTx: TxHashSchema,
  registeredBlock: BlockNumberSchema,
  /** address that paid gas to register — usually the agent runner itself (SMART-CONTRACT.md §2.3: only timing matters, not registrant identity). */
  registrant: z.string().min(1),
});
export type ProofDecision = z.infer<typeof ProofDecisionSchema>;

/** Post-deadline half — attested by ATTESTER_ROLE (keeper EOA in v1) from objective on-chain/protocol state. */
export const ProofOutcomeSchema = z.object({
  status: z.enum(["win", "loss", "neutral", "expired"]),
  pnlUsd1: Usd1Schema,
  evidenceHash: Hex32Schema,
  attestedAt: IsoDatetimeSchema,
  attestedTx: TxHashSchema,
  attestedBlock: BlockNumberSchema,
  /** e.g. "PancakeSwap v3 Quoter", "Venus position state" — SMART-CONTRACT.md §4 resolution sources. */
  resolutionSource: z.string().min(1),
});
export type ProofOutcome = z.infer<typeof ProofOutcomeSchema>;

/**
 * One append-only decision→outcome pair. `outcome` is `null` while the
 * record is pending (registered, deadline not yet resolved) — this is the
 * ONLY mutation this object ever undergoes conceptually (pending → resolved
 * is modeled as a brand-new record read from the chain each time, never an
 * in-place edit of a stored row — see CLAUDE.md §1 append-only law).
 */
export const ProofRecordSchema = z
  .object({
    recordId: RecordIdSchema,
    agentId: AgentIdSchema,
    decision: ProofDecisionSchema,
    outcome: ProofOutcomeSchema.nullable(),
  })
  .refine(
    (record) => {
      const registeredAtMs = Date.parse(record.decision.registeredAt);
      const deadlineMs = Date.parse(record.decision.deadline);
      // pre-registration guarantee: a deadline must sit strictly after registration...
      if (!(deadlineMs > registeredAtMs)) return false;
      // ...and within the anti-front-running window (SMART-CONTRACT.md §2.3).
      const maxDeadlineMs = registeredAtMs + MAX_DECISION_WINDOW_HOURS * 60 * 60 * 1000;
      if (deadlineMs > maxDeadlineMs) return false;
      return true;
    },
    {
      message: `decision.deadline must be strictly after decision.registeredAt and within ${MAX_DECISION_WINDOW_HOURS}h of it`,
      path: ["decision", "deadline"],
    },
  )
  .refine(
    (record) => {
      if (!record.outcome) return true; // still pending — nothing to check yet
      // THE core moat invariant: decision strictly precedes execution/outcome,
      // both in wall-clock time and in block order (indexer verifies
      // decision.block < execution.block per SMART-CONTRACT.md §2.3).
      const registeredAtMs = Date.parse(record.decision.registeredAt);
      const attestedAtMs = Date.parse(record.outcome.attestedAt);
      if (!(registeredAtMs < attestedAtMs)) return false;
      if (!(record.decision.registeredBlock < record.outcome.attestedBlock)) return false;
      return true;
    },
    {
      message:
        "append-only/pre-registration violation: outcome.attestedAt/attestedBlock must be strictly after decision.registeredAt/registeredBlock",
      path: ["outcome"],
    },
  )
  .refine(
    (record) => {
      if (!record.outcome) return true;
      // ProofLedger's attestOutcome is explicitly a POST-DEADLINE call
      // (SMART-CONTRACT.md §2.2 interface comment: "post-deadline (ATTESTER
      // role...)" — the keeper only resolves win/loss/neutral/expired once
      // the committed deadline has passed, never before it.
      const deadlineMs = Date.parse(record.decision.deadline);
      const attestedAtMs = Date.parse(record.outcome.attestedAt);
      return attestedAtMs >= deadlineMs;
    },
    {
      message: "outcome.attestedAt must be at or after decision.deadline — attestation is a post-deadline call",
      path: ["outcome", "attestedAt"],
    },
  )
  .refine(
    (record) => {
      if (!record.outcome) return true;
      // a resolved-but-unexecuted record can only be "expired", never win/loss/neutral with nonzero pnl claims
      if (record.outcome.status === "expired") return record.outcome.pnlUsd1 === 0;
      return true;
    },
    {
      message: "an expired (deadline passed, never executed) outcome must carry pnlUsd1 === 0",
      path: ["outcome", "pnlUsd1"],
    },
  );
export type ProofRecord = z.infer<typeof ProofRecordSchema>;

export const ProofRecordListSchema = z.array(ProofRecordSchema);
