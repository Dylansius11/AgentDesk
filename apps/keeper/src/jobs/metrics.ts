/**
 * apps/keeper/src/jobs/metrics.ts
 *
 * proof_metrics recompute — ERD.md §5: "keeper metrics job... recompute
 * proof_metrics from on-chain rows only". This is the ONLY writer of
 * proof_metrics (apps/api's services/metrics.ts only reads it) — never
 * hand-edited, per the ERD table's own note.
 *
 * Two trigger paths, both funnel into recomputeMetricsForAgent():
 *  1. enqueueMetricsRecompute(agentId) — called by jobs/attester.ts right
 *     after a successful attestation (per-agent, immediate).
 *  2. runMetricsHourlyTick() — the interval job (KEEPER_METRICS_INTERVAL_MS,
 *     default 1h) that sweeps every agent as a safety net.
 *
 * WIRED THIS WAVE (2026-08-17, proof-engine-engineer): recomputeMetricsForAgent()
 * is now real. Everything below is derived from `proof_records` ONLY —
 * never from `listings` or any agent-reported field (CLAUDE.md rule 3,
 * ERD.md §5's own note on this table). Per agent, per window ('7d' / '30d'
 * / 'all'), it:
 *
 *   - pulls every proof_records row for that agent (both kinds) in one
 *     query, splits into decision-rows-by-id and outcome-rows;
 *   - a record counts as "resolved" once its outcome row exists — window
 *     membership is decided by the outcome's real on-chain attestedAt
 *     (mirrored into `raw.attestedAt`, unix seconds, by db/proof-records.ts
 *     at insert time — there is no dedicated `attested_at` timestamp
 *     column on proof_records, see that file's insert shape);
 *   - winRate = wins / resolved (outcome_status = 'win' exactly; 'neutral'
 *     is not a win);
 *   - verifiedReturnPct = SUM(pnl_usd1) over resolved records in the window
 *     — the literal "return-weighted aggregate" SMART-CONTRACT.md §2.3
 *     describes ("Rankings are return-weighted (pnlUsd1-weighted)... dust
 *     tasks produce dust rankings"). Expressed as a dollar sum, not
 *     normalized against a committed notional, because `sizeUsd1` is only
 *     ever committed inside `intentHash`'s pre-image on-chain — it is
 *     never itself indexed into proof_records (decision rows only mirror
 *     the hash, not its inputs). Normalizing this into a true percentage
 *     would require either (a) capturing sizeUsd1 as its own indexed field
 *     going forward, or (b) the registrant publishing the pre-image
 *     alongside the hash — out of this task's scope; documented here so
 *     the next wave doesn't have to rediscover it.
 *   - avgResponseMin = mean(outcome.raw.attestedAt - matching
 *     decision.raw.registeredAt) in minutes, over resolved records in the
 *     window that have both real timestamps;
 *   - maxDrawdownPct = standard running peak-to-trough %, walking resolved
 *     records in the window ordered by real attestedAt ascending over
 *     cumulative pnl_usd1. Guarded against peak <= 0 (division), which is
 *     exactly the current real-data state (all pnl_usd1 = 0 so far —
 *     resolution against real market data isn't wired yet) — the query
 *     path is proven, the numbers are honestly zero because the inputs are
 *     zero, not because the math is stubbed.
 *
 * Upserts one row per (agentId, window) into proof_metrics. Unlike
 * proof_records this table is NOT append-only — ERD.md §2 calls it
 * "derived per agent (recomputed by keeper; never hand-edited)" — so
 * onConflictDoUpdate() here is the correct operation, not a violation of
 * CLAUDE.md rule 1 (that rule protects the on-chain mirror rows, never the
 * aggregate recomputed from them).
 */
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { proofMetrics, proofRecords } from '../db/schema.js'
import { keeperConfigured } from '../env.js'
import { logger } from '../logger.js'

const pendingAgentIds = new Set<string>()

/** Called by jobs/attester.ts after a successful attestation. Fire-and-forget by design. */
export function enqueueMetricsRecompute(agentId: string): void {
  pendingAgentIds.add(agentId)
  logger.debug({ agentId, queueSize: pendingAgentIds.size }, 'metrics: recompute enqueued')
}

type MetricsWindow = '7d' | '30d' | 'all'
const WINDOWS: readonly MetricsWindow[] = ['7d', '30d', 'all']
const WINDOW_MS: Record<'7d' | '30d', number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

/**
 * Both decision and outcome rows carry the real on-chain unix-second
 * timestamp in their `raw` jsonb column (registeredAt / attestedAt
 * respectively) — see db/proof-records.ts's insert shape. There is no
 * dedicated timestamp column for either on proof_records, so this is the
 * one real source for response-time / window-membership math.
 */
function unixSecondsFromRaw(raw: unknown, field: string): number | null {
  if (!raw || typeof raw !== 'object') return null
  const value = (raw as Record<string, unknown>)[field]
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const seconds = Number(value)
  return Number.isFinite(seconds) ? seconds : null
}

interface ResolvedRecord {
  pnlUsd1: number
  isWin: boolean
  attestedAtMs: number | null
  registeredAtMs: number | null
}

async function recomputeMetricsForAgent(agentId: string): Promise<void> {
  if (!keeperConfigured.database) {
    logger.debug({ agentId }, 'metrics: skipped — DATABASE_URL not configured this session')
    return
  }
  const db = getDb()
  if (!db) return

  const rows = await db.select().from(proofRecords).where(eq(proofRecords.agentId, agentId))

  const decisionsById = new Map<number, (typeof rows)[number]>()
  const outcomeRows: (typeof rows)[number][] = []
  for (const row of rows) {
    if (row.kind === 'decision') decisionsById.set(row.id, row)
    else if (row.kind === 'outcome') outcomeRows.push(row)
  }

  // Precompute once — window filtering below is cheap array scans over
  // this per-agent record count (hackathon scale; a proper SQL WHERE on
  // raw->>'attestedAt' is the follow-up if per-agent volume ever justifies
  // it).
  const allResolved: ResolvedRecord[] = outcomeRows.map((outcome) => {
    const decision = decisionsById.get(outcome.id)
    return {
      pnlUsd1: outcome.pnlUsd1 === null ? 0 : Number(outcome.pnlUsd1),
      isWin: outcome.outcomeStatus === 'win',
      attestedAtMs: (() => {
        const s = unixSecondsFromRaw(outcome.raw, 'attestedAt')
        return s === null ? null : s * 1000
      })(),
      registeredAtMs: (() => {
        const s = decision ? unixSecondsFromRaw(decision.raw, 'registeredAt') : null
        return s === null ? null : s * 1000
      })(),
    }
  })

  const now = Date.now()

  for (const window of WINDOWS) {
    const cutoffMs = window === 'all' ? null : now - WINDOW_MS[window]

    const resolved = allResolved.filter((r) => {
      if (cutoffMs === null) return true
      return r.attestedAtMs !== null && r.attestedAtMs >= cutoffMs
    })

    const tasksResolved = resolved.length
    const wins = resolved.filter((r) => r.isWin).length
    const winRate = tasksResolved > 0 ? wins / tasksResolved : null

    const verifiedReturnPct =
      tasksResolved > 0 ? resolved.reduce((sum, r) => sum + r.pnlUsd1, 0) : null

    const responseMinutes = resolved
      .filter((r) => r.attestedAtMs !== null && r.registeredAtMs !== null)
      .map((r) => (r.attestedAtMs! - r.registeredAtMs!) / 60_000)
    const avgResponseMin =
      responseMinutes.length > 0
        ? responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length
        : null

    // Running peak-to-trough drawdown, walking resolved records in real
    // chronological (attestedAt) order over cumulative pnl_usd1.
    const chronological = resolved
      .filter((r) => r.attestedAtMs !== null)
      .sort((a, b) => a.attestedAtMs! - b.attestedAtMs!)
    let cumulative = 0
    let peak = 0
    let maxDrawdownPct = 0
    for (const r of chronological) {
      cumulative += r.pnlUsd1
      if (cumulative > peak) peak = cumulative
      if (peak > 0) {
        const drawdown = ((peak - cumulative) / peak) * 100
        if (drawdown > maxDrawdownPct) maxDrawdownPct = drawdown
      }
    }

    await db
      .insert(proofMetrics)
      .values({
        agentId,
        window,
        verifiedReturnPct: verifiedReturnPct === null ? null : verifiedReturnPct.toFixed(2),
        winRate: winRate === null ? null : winRate.toFixed(4),
        maxDrawdownPct: tasksResolved > 0 ? maxDrawdownPct.toFixed(2) : null,
        tasksResolved,
        avgResponseMin: avgResponseMin === null ? null : avgResponseMin.toFixed(1),
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [proofMetrics.agentId, proofMetrics.window],
        set: {
          verifiedReturnPct: verifiedReturnPct === null ? null : verifiedReturnPct.toFixed(2),
          winRate: winRate === null ? null : winRate.toFixed(4),
          maxDrawdownPct: tasksResolved > 0 ? maxDrawdownPct.toFixed(2) : null,
          tasksResolved,
          avgResponseMin: avgResponseMin === null ? null : avgResponseMin.toFixed(1),
          computedAt: new Date(),
        },
      })

    logger.debug(
      { agentId, window, tasksResolved, winRate, verifiedReturnPct, avgResponseMin, maxDrawdownPct },
      'metrics: window recomputed',
    )
  }

  logger.info({ agentId, resolvedTotal: allResolved.length }, 'metrics: recompute complete')
}

/** Drains the in-memory queue populated by enqueueMetricsRecompute(). */
async function drainPendingRecomputes(): Promise<void> {
  const batch = [...pendingAgentIds]
  pendingAgentIds.clear()
  for (const agentId of batch) {
    await recomputeMetricsForAgent(agentId)
  }
}

/** Hourly safety-net sweep (ERD.md §5 "... / hourly"). */
export async function runMetricsHourlyTick(): Promise<void> {
  await drainPendingRecomputes()
  if (!keeperConfigured.database) {
    logger.debug('metrics: hourly sweep skipped — DATABASE_URL not configured this session')
    return
  }
  const db = getDb()
  if (!db) return

  const distinctAgents = await db.selectDistinct({ agentId: proofRecords.agentId }).from(proofRecords)
  for (const { agentId } of distinctAgents) {
    await recomputeMetricsForAgent(agentId)
  }
  logger.info({ agentCount: distinctAgents.length }, 'metrics: hourly sweep complete')
}
