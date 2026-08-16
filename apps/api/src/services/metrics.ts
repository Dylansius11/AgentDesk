/**
 * apps/api/src/services/metrics.ts
 *
 * Leaderboard + landing-counter reads. Per ARCHITECTURE.md §1 boundary rule,
 * "the leaderboard is a materialized view of the ProofLedger, nothing more"
 * — this service only ever reads `proof_metrics` (written exclusively by the
 * keeper, see ERD.md §5). It must never derive a number from `listings` or
 * any agent-reported field and label it verified.
 *
 * NOT LIVE THIS SESSION — DB not provisioned; returns empty/zeroed stub
 * results, never fabricated-looking numbers (CLAUDE.md rule 3/constraint).
 *
 * TODO(Phase B):
 *  - getLeaderboard(): select proofMetrics ⨝ listings, ordered by
 *    verified_return_pct desc, filtered by category/window; cache 120s.
 *  - getLandingStats(): aggregate counts from agents/proof_records.
 *  - recomputeMetrics() is NOT called from the API — it's the keeper's job
 *    (apps/keeper) triggered after each attestation. Kept here only as the
 *    read-side type contract the keeper's write-side must satisfy.
 */
import { isDatabaseConfigured } from '../db/client.js'
import type { Category, LandingStats, LeaderboardEntry, MetricsWindow } from '../types/domain.js'

export interface GetLeaderboardParams {
  window: MetricsWindow
  category?: Category
}

export async function getLeaderboard(
  params: GetLeaderboardParams,
): Promise<{ entries: LeaderboardEntry[]; stale: boolean }> {
  void params
  if (!isDatabaseConfigured()) {
    return { entries: [], stale: false }
  }
  // TODO(Phase B): query proofMetrics ⨝ listings.
  return { entries: [], stale: false }
}

export async function getLandingStats(): Promise<LandingStats> {
  // TODO(Phase B): aggregate COUNT(*) from agents / proof_records.
  return {
    totalAgents: 0,
    verifiedAgents: 0,
    totalDecisionsRegistered: 0,
    totalOutcomesAttested: 0,
  }
}
