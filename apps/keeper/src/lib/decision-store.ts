/**
 * apps/keeper/src/lib/decision-store.ts
 *
 * Session-only, in-memory mirror of "decisions with no matching outcome
 * yet" — the exact query jobs/attester.ts's original TODO described against
 * a real `proof_records` table (`decision LEFT JOIN outcome ON ... WHERE
 * outcome IS NULL AND deadline < now()`, ERD.md §5). Backed by memory
 * instead of Postgres because DATABASE_URL isn't provisioned this session
 * (Wave 4 scope: prove indexer -> attester wiring against a real chain;
 * Postgres persistence is unchanged Phase B scope — the TODOs in indexer.ts
 * and attester.ts for the real INSERT/SELECT are left in place).
 *
 * This store is NEVER the source of truth, even while populated — the chain
 * is. jobs/attester.ts still re-reads the record straight from ProofLedger
 * (`getDecision`) before resolving an outcome, exactly as it would if this
 * were seeded from a Postgres mirror that might itself be stale (CLAUDE.md
 * §5.7 "DB may lag, never lead or lie"). This module only spares the
 * attester job from re-scanning every block from genesis on every tick to
 * find candidates.
 */
import { logger } from '../logger.js'

export interface IndexedDecision {
  recordId: bigint
  agentId: bigint
  intentHash: `0x${string}`
  deadline: bigint
  registeredAt: bigint
  txHash?: `0x${string}`
}

const decisionsByRecordId = new Map<string, IndexedDecision>()
const attestedRecordIds = new Set<string>()

/** Called by jobs/indexer.ts for every DecisionRegistered event it observes. */
export function upsertDecision(decision: IndexedDecision): void {
  decisionsByRecordId.set(decision.recordId.toString(), decision)
}

/** Called by jobs/indexer.ts for every OutcomeAttested event it observes (from anyone, not just us). */
export function markAttestedFromEvent(recordId: bigint): void {
  attestedRecordIds.add(recordId.toString())
}

/** Called by jobs/attester.ts right after its own successful attestOutcome submission. */
export function markAttestedLocally(recordId: bigint): void {
  attestedRecordIds.add(recordId.toString())
}

/** Mirrors "SELECT decisions WHERE deadline < now AND no outcome row yet". */
export function listUnresolvedPastDeadline(nowSec: bigint): IndexedDecision[] {
  const out: IndexedDecision[] = []
  for (const [key, decision] of decisionsByRecordId) {
    if (attestedRecordIds.has(key)) continue
    if (decision.deadline > nowSec) continue
    out.push(decision)
  }
  return out
}

/** Diagnostics only — never used for anything authoritative. */
export function decisionStoreSize(): { decisions: number; attested: number } {
  return { decisions: decisionsByRecordId.size, attested: attestedRecordIds.size }
}

export function logDecisionStoreState(): void {
  logger.debug(decisionStoreSize(), 'decision-store: state')
}
