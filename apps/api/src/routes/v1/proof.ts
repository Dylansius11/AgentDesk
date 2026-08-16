/**
 * apps/api/src/routes/v1/proof.ts
 *
 * ProofLedger-derived reads: per-agent proof records, the leaderboard,
 * the public verify/audit page, and landing stats. Grouped here (rather
 * than in agents.ts) because every endpoint in this file reads ONLY from
 * proof_records/proof_metrics — the moat tables — never from listings or
 * agent-reported fields (ARCHITECTURE.md §1 boundary rule: "the leaderboard
 * is a materialized view of the ProofLedger, nothing more").
 *
 * Path note: mounted at the /v1 ROOT in routes/v1/index.ts; paths below are
 * written in full to match ERD.md §4 literally, including "/agents/:id/proof"
 * which nests under /agents in the URL despite living in this file.
 */

import { Hono } from 'hono'
import { getLandingStats, getLeaderboard } from '../../services/metrics.js'
import { getProofRecordsForAgent, getVerifyBundle } from '../../services/proof.js'

export const proofRouter = new Hono()

/** GET /v1/agents/:id/proof — ERD.md §4, paginated, `kind` filter. */
proofRouter.get('/agents/:id/proof', async (c) => {
  const agentId = c.req.param('id')
  const kindParam = c.req.query('kind')
  const kind = kindParam === 'decision' || kindParam === 'outcome' ? kindParam : undefined
  const cursor = c.req.query('cursor')
  const result = await getProofRecordsForAgent({ agentId, kind, cursor })
  return c.json({ data: result.records, meta: { nextCursor: result.nextCursor } })
})

/** GET /v1/leaderboard?window&category — ERD.md §4, 120s cache. */
proofRouter.get('/leaderboard', async (c) => {
  const windowParam = c.req.query('window')
  const window =
    windowParam === '7d' || windowParam === '30d' || windowParam === 'all' ? windowParam : '30d'
  const categoryParam = c.req.query('category')
  const category =
    categoryParam === 'grid' ||
    categoryParam === 'rebalance' ||
    categoryParam === 'yield' ||
    categoryParam === 'health'
      ? categoryParam
      : undefined
  const result = await getLeaderboard({ window, category })
  return c.json({ data: result.entries, meta: { stale: result.stale, window } })
})

/** GET /v1/verify/:agentId — ERD.md §4, raw on-chain audit trail. */
proofRouter.get('/verify/:agentId', async (c) => {
  const agentId = c.req.param('agentId')
  const bundle = await getVerifyBundle(agentId)
  return c.json({ data: bundle })
})

/** GET /v1/stats — ERD.md §4, landing counters. */
proofRouter.get('/stats', async (c) => {
  const stats = await getLandingStats()
  return c.json({ data: stats })
})
