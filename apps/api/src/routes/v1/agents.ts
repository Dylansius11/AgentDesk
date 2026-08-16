/**
 * apps/api/src/routes/v1/agents.ts
 *
 * Agent identity + discovery endpoints — the 8004scan-backed side of the API
 * (ERD.md §4: agents ⨝ listings ⨝ proof_metrics reads, plus the publish/claim
 * write). ProofLedger-derived endpoints (proof records, leaderboard, verify,
 * stats) live in routes/v1/proof.ts even where their URL nests under
 * /agents/:id — see that file's header for why.
 *
 * Every handler below is a structural stub: real route shape + zod input
 * validation, but responses are empty arrays / null / obviously-placeholder
 * ids, never fabricated "verified" numbers (CLAUDE.md constraint).
 *
 * Path note: this router is mounted at the /v1 ROOT (not under an /agents
 * prefix) in routes/v1/index.ts, and every path below is written in full
 * (e.g. "/agents", "/publish") so it matches ERD.md §4's documented paths
 * literally — "/publish" is a top-level path, not "/agents/publish".
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { getAgentDetail, listAgents } from '../../services/scan8004.js'

export const agentsRouter = new Hono()

const listQuerySchema = z.object({
  category: z.enum(['grid', 'rebalance', 'yield', 'health']).optional(),
  verified: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  sort: z.string().optional(),
})

/** GET /v1/agents?category&verified&sort — ERD.md §4, 60s cache. */
agentsRouter.get('/agents', zValidator('query', listQuerySchema), async (c) => {
  const params = c.req.valid('query')
  const result = await listAgents(params)
  return c.json({ data: result.data, meta: { stale: result.stale, fetchedAt: result.fetchedAt } })
})

/** GET /v1/agents/:id — ERD.md §4, 30s cache, includes trust panel source. */
agentsRouter.get('/agents/:id', async (c) => {
  const id = c.req.param('id')
  const result = await getAgentDetail(id)
  if (!result.data) {
    return c.json({ error: 'agent_not_found', agentId: id }, 404)
  }
  return c.json({ data: result.data, meta: { stale: result.stale, fetchedAt: result.fetchedAt } })
})

const publishBodySchema = z.object({
  agentId: z.string().min(1),
  category: z.enum(['grid', 'rebalance', 'yield', 'health']),
  tagline: z.string().min(1).max(140),
  description: z.string().min(1).max(4000),
  ownerSignature: z.string().min(1), // SIWE-style message signature (ARCHITECTURE.md §6 security)
})

/**
 * POST /v1/publish — ERD.md §4 claim flow. Mounted at top-level /publish
 * (not nested under /agents) to match the ERD-documented path exactly; kept
 * in this file because it operates on agents+listings+developers.
 */
agentsRouter.post('/publish', zValidator('json', publishBodySchema), async (c) => {
  const body = c.req.valid('json')
  // TODO(Phase B): verify body.ownerSignature against the ERC-8004 registry
  // owner for body.agentId (SIWE-style, per ARCHITECTURE.md §6 security);
  // upsert listings + developers rows on success. Never trust an unsigned claim.
  return c.json(
    {
      error: 'not_implemented',
      message: 'publish/claim requires owner-signature verification — Phase B',
      agentId: body.agentId,
    },
    501,
  )
})
