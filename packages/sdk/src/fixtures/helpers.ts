/**
 * packages/sdk/src/fixtures/helpers.ts
 *
 * Internal-only fixture builders. Every narrative fact (recordId, dates,
 * pnl, status, action) is passed explicitly by the fixture file that calls
 * these — nothing here invents outcomes. What these DO generate
 * deterministically is the boilerplate that would otherwise be hundreds of
 * hand-typed 64-char hex strings: tx hashes, hashes, addresses, block
 * numbers. Deterministic (seeded by a plain string) so fixtures are stable
 * across runs/diffs.
 */
import { createHash } from "node:crypto";
import type { Address, Hex32, TxHash } from "../schemas/primitives";
import type { ProofAction, ProofDecision, ProofOutcome, ProofRecord } from "../schemas/proof-record";

function sha256Hex(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

/** Deterministic 0x-prefixed 32-byte hex value from a seed string. */
export function mkHex32(seed: string): Hex32 {
  return `0x${sha256Hex(seed)}` as Hex32;
}

/** Deterministic 0x-prefixed 20-byte EVM address from a seed string. */
export function mkAddress(seed: string): Address {
  return `0x${sha256Hex(seed).slice(0, 40)}` as Address;
}

export const mkTxHash = mkHex32 satisfies (seed: string) => TxHash;

/** A believable, deterministic increasing block number seeded off a date + a small nonce. */
export function mkBlock(iso: string, nonce = 0): number {
  // BSC ~3s block time; anchor to a plausible mainnet block near the 2026-08 chain height.
  const base = 52_000_000;
  const secondsSinceEpoch = Math.floor(Date.parse(iso) / 1000);
  return base + Math.floor(secondsSinceEpoch / 3) % 5_000_000 + nonce;
}

/** ISO datetime `n` days before a fixed "today" anchor, at a given hour/minute (UTC). */
export function isoAt(year: number, month: number, day: number, hour = 12, minute = 0): string {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0)).toISOString();
}

/** Add minutes to an ISO datetime string, returning a new ISO datetime string. */
export function plusMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

/** Add hours to an ISO datetime string, returning a new ISO datetime string. */
export function plusHours(iso: string, hours: number): string {
  return plusMinutes(iso, hours * 60);
}

export function buildAction(input: Omit<ProofAction, "params"> & { params?: ProofAction["params"] }): ProofAction {
  return { params: {}, ...input };
}

export function buildDecision(input: {
  seed: string;
  action: ProofAction;
  registeredAt: string;
  deadlineHoursOut: number;
  registrant: Address;
}): ProofDecision {
  return {
    intentHash: mkHex32(`${input.seed}:intent`),
    action: input.action,
    deadline: plusHours(input.registeredAt, input.deadlineHoursOut),
    registeredAt: input.registeredAt,
    registeredTx: mkTxHash(`${input.seed}:register-tx`),
    registeredBlock: mkBlock(input.registeredAt, 1),
    registrant: input.registrant,
  };
}

export function buildOutcome(input: {
  seed: string;
  status: ProofOutcome["status"];
  pnlUsd1: number;
  attestedAt: string;
  registeredAtForBlock: string;
  resolutionSource: string;
}): ProofOutcome {
  return {
    status: input.status,
    pnlUsd1: input.pnlUsd1,
    evidenceHash: mkHex32(`${input.seed}:evidence`),
    attestedAt: input.attestedAt,
    attestedTx: mkTxHash(`${input.seed}:attest-tx`),
    attestedBlock: mkBlock(input.registeredAtForBlock, 2) + 50, // strictly after the decision's block
    resolutionSource: input.resolutionSource,
  };
}

/**
 * Builds one resolved (decision + outcome) proof record. Timeline modeled
 * per SMART-CONTRACT.md §2.2: the agent executes sometime before
 * `deadline` (the execution tx itself is folded into `evidenceHash`, not a
 * top-level field here), and the keeper's `attestOutcome` call only ever
 * happens AFTER `deadline` — `resolveMinutesAfterDeadline` models that
 * post-deadline keeper-poll latency.
 */
export function buildResolvedRecord(input: {
  recordId: number;
  agentId: string;
  seed: string;
  registrant: Address;
  action: ProofAction;
  registeredAt: string;
  deadlineHoursOut: number;
  resolveMinutesAfterDeadline: number;
  status: ProofOutcome["status"];
  pnlUsd1: number;
  resolutionSource: string;
}): ProofRecord {
  const decision = buildDecision({
    seed: input.seed,
    action: input.action,
    registeredAt: input.registeredAt,
    deadlineHoursOut: input.deadlineHoursOut,
    registrant: input.registrant,
  });
  const attestedAt = plusMinutes(decision.deadline, input.resolveMinutesAfterDeadline);
  const outcome = buildOutcome({
    seed: input.seed,
    status: input.status,
    pnlUsd1: input.pnlUsd1,
    attestedAt,
    registeredAtForBlock: input.registeredAt,
    resolutionSource: input.resolutionSource,
  });
  return {
    recordId: input.recordId,
    agentId: input.agentId,
    decision,
    outcome,
  };
}

/** Builds one still-pending record: registered on-chain, deadline not yet resolved. Used for freshly-listed/unverified agents. */
export function buildPendingRecord(input: {
  recordId: number;
  agentId: string;
  seed: string;
  registrant: Address;
  action: ProofAction;
  registeredAt: string;
  deadlineHoursOut: number;
}): ProofRecord {
  const decision = buildDecision({
    seed: input.seed,
    action: input.action,
    registeredAt: input.registeredAt,
    deadlineHoursOut: input.deadlineHoursOut,
    registrant: input.registrant,
  });
  return {
    recordId: input.recordId,
    agentId: input.agentId,
    decision,
    outcome: null,
  };
}
