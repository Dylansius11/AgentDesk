/**
 * packages/sdk/src/schemas/agent.ts
 *
 * The marketplace-facing Agent shape: ERC-8004 identity (ERD.md `agents`) +
 * our listing layer (ERD.md `listings`) + the Proof Engine outputs
 * (`proof_metrics`, `proof_records`, equity curve) + the Trust Panel. This
 * is deliberately the FULL object a `GET /v1/agents/:id`-equivalent client
 * call returns — the fixture client (Phase A) and the real Hono/8004scan
 * client (Phase B, task B1) both produce values that satisfy this same
 * schema (ARCHITECTURE.md §3 import rule: sdk is the shared seam).
 */
import { z } from "zod";
import { AddressSchema, AgentIdSchema, IsoDatetimeSchema, Usd1NonNegativeSchema } from "./primitives.js";
import { CategorySchema } from "./category.js";
import { TrustPanelSchema } from "./trust-panel.js";
import { ProofMetricsSchema } from "./proof-metrics.js";
import { EquityCurveSchema } from "./equity-curve.js";
import { ProofRecordListSchema } from "./proof-record.js";

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ListingStatusSchema = z.enum(["active", "paused", "delisted"]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const AgentSchema = z
  .object({
    // ── ERC-8004 identity (ERD.md `agents`) ──
    id: AgentIdSchema,
    chainId: z.union([z.literal(56), z.literal(97)]), // 56 = BSC mainnet, 97 = Chapel testnet
    ownerAddress: AddressSchema,
    registeredAt: IsoDatetimeSchema,
    capabilities: z.array(z.string()).default([]),

    // ── marketplace listing layer (ERD.md `listings`) ──
    name: z.string().min(1),
    tagline: z.string().min(1),
    description: z.string().min(1),
    category: CategorySchema,
    riskLevel: RiskLevelSchema,
    pricePerTaskUsd1: Usd1NonNegativeSchema,
    status: ListingStatusSchema,
    proofProgram: z.boolean(),
    claimedBy: AddressSchema.nullable(),
    claimedAt: IsoDatetimeSchema.nullable(),

    // ── Trust Panel (suggested default caps shown pre-hire) ──
    trustPanel: TrustPanelSchema,

    // ── Proof Engine outputs — derived from on-chain rows only ──
    /** Display flag. See refine below: can never be `true` without resolved, on-chain-derived metrics behind it. */
    verified: z.boolean(),
    /** `null` exactly when there is nothing on-chain yet to derive metrics from. */
    metrics: ProofMetricsSchema.nullable(),
    equityCurve: EquityCurveSchema,
    proofRecords: ProofRecordListSchema,
  })
  .refine(
    (agent) => {
      // CLAUDE.md §3 moat law, enforced at the type level: "Never show an
      // unverifiable number as if it were verified." An agent can only be
      // marked verified if it opted into the Proof Program AND has at least
      // one resolved on-chain record behind its metrics.
      if (!agent.verified) return true;
      return agent.proofProgram === true && agent.metrics !== null && agent.metrics.tasksResolved > 0;
    },
    {
      message:
        "Agent.verified=true requires proofProgram=true and non-null metrics with tasksResolved>0 — verified status must be derivable from proof records alone",
      path: ["verified"],
    },
  )
  .refine(
    (agent) => {
      // symmetric guard: no metrics/equity curve without at least one proof record to back them
      if (agent.metrics !== null && agent.proofRecords.length === 0) return false;
      if (agent.equityCurve.length > 0 && agent.proofRecords.length === 0) return false;
      return true;
    },
    {
      message: "metrics and equityCurve must be empty/null when there are zero proofRecords to derive them from",
      path: ["proofRecords"],
    },
  );
export type Agent = z.infer<typeof AgentSchema>;

export const AgentListSchema = z.array(AgentSchema);
