/**
 * apps/keeper/src/jobs/metrics.ts
 *
 * proof_metrics recompute — ERD.md §5: "keeper metrics job | after any
 * attest / hourly | recompute proof_metrics from on-chain rows only".
 * This is the ONLY writer of proof_metrics (apps/api's services/metrics.ts
 * only reads it) — never hand-edited, per the ERD table's own note.
 *
 * Two trigger paths, both funnel into recomputeMetricsForAgent():
 *  1. enqueueMetricsRecompute(agentId) — called by jobs/attester.ts right
 *     after a successful attestation (per-agent, immediate).
 *  2. runMetricsHourlyTick() — the interval job (KEEPER_METRICS_INTERVAL_MS,
 *     default 1h) that sweeps every agent as a safety net.
 *
 * NOT WIRED THIS SESSION — recomputeMetricsForAgent() is a no-op until
 * DATABASE_URL is provisioned; the queue below is real (in-memory) so the
 * call graph from attester.ts is exercised end-to-end, just not persisted.
 */
import { keeperConfigured } from '../env.js'
import { logger } from '../logger.js'

const pendingAgentIds = new Set<string>()

/** Called by jobs/attester.ts after a successful attestation. Fire-and-forget by design. */
export function enqueueMetricsRecompute(agentId: string): void {
  pendingAgentIds.add(agentId)
  logger.debug({ agentId, queueSize: pendingAgentIds.size }, 'metrics: recompute enqueued')
}

async function recomputeMetricsForAgent(agentId: string): Promise<void> {
  if (!keeperConfigured.database) {
    logger.debug({ agentId }, 'metrics: skipped — DATABASE_URL not configured this session')
    return
  }
  // TODO(Phase B): recompute verified_return_pct / win_rate / max_drawdown_pct
  // / tasks_resolved / avg_response_min / category_stat per window (7d/30d/all)
  // from proof_records ONLY (never from listings or agent-reported fields),
  // then upsert into proof_metrics.
  logger.debug({ agentId }, 'metrics: recompute (no-op stub)')
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
  // TODO(Phase B): SELECT DISTINCT agent_id FROM proof_records, recompute all.
  logger.debug('metrics: hourly sweep (no-op stub)')
}
