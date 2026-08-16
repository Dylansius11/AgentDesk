/**
 * apps/api/src/routes/v1/sessions.ts
 *
 * Altana Keystore session mirror reads — backs the Trust Panel
 * (INTEGRATION.md I6, bnb-agent-stack skill: "the plain-language permission
 * sentences render from the actual session config"). ERD.md §4's API-surface
 * table doesn't list a standalone /v1/sessions path (session state rides
 * along with /v1/jobs/:id and the revoke action is POST /v1/jobs/:id/revoke)
 * — this file is an intentional, documented extrapolation so the route file
 * ARCHITECTURE.md §3 names (`sessions.ts`) has real content: a read endpoint
 * the Trust Panel component can hit directly by session id, independent of
 * reloading the whole job.
 *
 * Writes (create/revoke) stay owned by services/hire.ts + services/altana.ts
 * via the /v1/jobs/:id/fund and /v1/jobs/:id/revoke routes — this file is
 * read-only by design so there is exactly one revoke code path.
 *
 * Path note: mounted at the /v1 ROOT in routes/v1/index.ts.
 */

import { Hono } from 'hono'
import { permissionSentence } from '../../services/altana.js'

export const sessionsRouter = new Hono()

/** GET /v1/sessions/:id — session mirror row (allowlist, spend cap, expiry, revoked_at). */
sessionsRouter.get('/sessions/:id', async (c) => {
  const id = c.req.param('id')
  // TODO(Phase B): read from `sessions` table (mirrors Altana Keystore per
  // ERD.md §5 "keeper session watcher" sync rule). Stub: not found, not fabricated.
  return c.json({ error: 'session_not_found', sessionId: id }, 404)
})

/**
 * GET /v1/sessions/:id/permission-sentence — the exact Trust Panel sentence
 * for this session, derived only from the session config (never paraphrased
 * from agent-reported claims). 404 until session reads are wired (Phase B).
 */
sessionsRouter.get('/sessions/:id/permission-sentence', async (c) => {
  const id = c.req.param('id')
  void permissionSentence // wired once GET /sessions/:id above returns real rows
  return c.json({ error: 'session_not_found', sessionId: id }, 404)
})
