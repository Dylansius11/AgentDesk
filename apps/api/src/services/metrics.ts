/**
 * apps/api/src/services/metrics.ts
 *
 * Leaderboard + landing-counter reads. Per ARCHITECTURE.md §1 boundary rule,
 * "the leaderboard is a materialized view of the ProofLedger, nothing more"
 * — this service only ever reads `proof_metrics` (written exclusively by the
 * keeper, see ERD.md §5). It must never derive a number from `listings` or
 * any agent-reported field and label it verified.
 *
 * WIRED THIS WAVE (2026-08-17, proof-engine-engineer):
 *  - getLandingStats(): real COUNT(*)-style aggregates against
 *    agents/proof_records/proof_metrics. This is the task's explicit scope
 *    boundary — simple counts only, no derivation.
 *  - getLeaderboard(): also wired to a real SELECT (proof_metrics ⨝
 *    listings, no computed columns) since it's a plain read+join, not a
 *    derivation — but it will legitimately return an EMPTY list until the
 *    keeper's recomputeMetricsForAgent() (apps/keeper/src/jobs/metrics.ts)
 *    is implemented, because no proof_metrics rows exist yet. That
 *    per-agent rolling-window win-rate/PnL computation engine is explicitly
 *    OUT OF SCOPE for this task (see this task's final report for the
 *    follow-up write-up) — do not build it here.
 */
import { and, desc, eq } from 'drizzle-orm'
import { getDb, isDatabaseConfigured } from '../db/client.js'
import { agents, listings, proofMetrics, proofRecords } from '../db/schema.js'
import type { Category, LandingStats, LeaderboardEntry, MetricsWindow } from '../types/domain.js'

export interface GetLeaderboardParams {
  window: MetricsWindow
  category?: Category
}

export async function getLeaderboard(
  params: GetLeaderboardParams,
): Promise<{ entries: LeaderboardEntry[]; stale: boolean }> {
  if (!isDatabaseConfigured()) {
    return { entries: [], stale: false }
  }
  const db = getDb()
  if (!db) return { entries: [], stale: false }

  const conditions = [eq(proofMetrics.window, params.window)]
  if (params.category) conditions.push(eq(listings.category, params.category))

  const rows = await db
    .select({
      agentId: proofMetrics.agentId,
      category: listings.category,
      verifiedReturnPct: proofMetrics.verifiedReturnPct,
      winRate: proofMetrics.winRate,
      tasksResolved: proofMetrics.tasksResolved,
      window: proofMetrics.window,
    })
    .from(proofMetrics)
    .innerJoin(listings, eq(listings.agentId, proofMetrics.agentId))
    .where(and(...conditions))
    .orderBy(desc(proofMetrics.verifiedReturnPct))

  const entries: LeaderboardEntry[] = rows
    .filter((r) => r.category !== null)
    .map((r) => ({
      agentId: r.agentId,
      category: r.category as Category,
      verifiedReturnPct: r.verifiedReturnPct === null ? 0 : Number(r.verifiedReturnPct),
      winRate: r.winRate === null ? 0 : Number(r.winRate),
      tasksResolved: r.tasksResolved ?? 0,
      window: r.window,
    }))

  return { entries, stale: false }
}

export async function getLandingStats(): Promise<LandingStats> {
  if (!isDatabaseConfigured()) {
    return {
      totalAgents: 0,
      verifiedAgents: 0,
      totalDecisionsRegistered: 0,
      totalOutcomesAttested: 0,
    }
  }
  const db = getDb()
  if (!db) {
    return {
      totalAgents: 0,
      verifiedAgents: 0,
      totalDecisionsRegistered: 0,
      totalOutcomesAttested: 0,
    }
  }

  const [agentRows, verifiedRows, decisionRows, outcomeRows] = await Promise.all([
    db.select({ id: agents.id }).from(agents),
    db.selectDistinct({ agentId: proofMetrics.agentId }).from(proofMetrics),
    db.select({ id: proofRecords.id }).from(proofRecords).where(eq(proofRecords.kind, 'decision')),
    db.select({ id: proofRecords.id }).from(proofRecords).where(eq(proofRecords.kind, 'outcome')),
  ])

  return {
    totalAgents: agentRows.length,
    verifiedAgents: verifiedRows.length,
    totalDecisionsRegistered: decisionRows.length,
    totalOutcomesAttested: outcomeRows.length,
  }
}
