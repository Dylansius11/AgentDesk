/**
 * apps/api/src/routes/v1/jobs.ts
 *
 * ERC-8183 escrow job lifecycle (ARCHITECTURE.md §4.2 hire sequence,
 * ERD.md §4). All write logic delegates to services/hire.ts, which in turn
 * calls services/altana.ts for the actual escrow/session mechanics
 * (`hireErc8183Agent`) — this file must never implement escrow itself
 * (CLAUDE.md rule 1).
 *
 * Path note: mounted at the /v1 ROOT in routes/v1/index.ts; paths below are
 * written in full to match ERD.md §4 literally.
 *
 * LIVE (2026-08-17): request validation now uses the real
 * `HireConfigSchema` from `@agentdesk/sdk` (was a hand-rolled local
 * duplicate — flagged as a gap since Wave 2, fixed here) — same schema
 * `packages/sdk`'s fixtures-backed `AgentDeskClient.hire()` validates
 * against, so the mock seam and the real API finally agree on one shape.
 */
import { AddressSchema, AgentIdSchema, HireConfigSchema } from '@agentdesk/sdk'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import {
  createJob,
  DatabaseNotConfiguredError,
  fundJob,
  revokeJob,
  SessionNotLiveError,
  streamJobEvents,
} from '../../services/hire.js'

export const jobsRouter = new Hono()

const createJobBodySchema = z.object({
  agentId: AgentIdSchema,
  hirerAddress: AddressSchema,
  config: HireConfigSchema,
})

/** POST /v1/jobs — ERD.md §4, creates job intent + Altana session params. Wallet sig required in Phase B. */
jobsRouter.post('/jobs', zValidator('json', createJobBodySchema), async (c) => {
  const body = c.req.valid('json')
  try {
    const job = await createJob(body)
    return c.json({ data: job }, 201)
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) {
      return c.json({ error: 'database_not_configured', message: err.message }, 503)
    }
    throw err
  }
})

/**
 * POST /v1/jobs/:id/fund — ERD.md §4, escrow funding via I4 (Altana
 * hireErc8183Agent). Real call path — expected, this wave, to return an
 * honest `pending_funding` status when it hits the documented $U wall
 * (INTEGRATION.md I4), never a fake `funded`.
 */
jobsRouter.post('/jobs/:id/fund', async (c) => {
  const id = c.req.param('id')
  try {
    const job = await fundJob(id)
    if (!job) {
      return c.json({ error: 'job_not_found', jobId: id }, 404)
    }
    return c.json({ data: job })
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) {
      return c.json({ error: 'database_not_configured', message: err.message }, 503)
    }
    throw err
  }
})

/** POST /v1/jobs/:id/revoke — ERD.md §4, Keystore revoke tx (1 tx, in-product). Idempotent. */
jobsRouter.post('/jobs/:id/revoke', async (c) => {
  const id = c.req.param('id')
  try {
    const job = await revokeJob(id)
    if (!job) {
      return c.json({ error: 'job_not_found', jobId: id }, 404)
    }
    return c.json({ data: job })
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) {
      return c.json({ error: 'database_not_configured', message: err.message }, 503)
    }
    if (err instanceof SessionNotLiveError) {
      // Honest refusal, not a faked revoke — see services/hire.ts's
      // "KNOWN LIMITATION" banner (in-process session cache, no restart
      // persistence of raw session key material by design).
      return c.json({ error: 'session_not_live', jobId: id, message: err.message }, 409)
    }
    throw err
  }
})

/**
 * GET /v1/jobs/:id/events — ERD.md §4, SSE dashboard live feed
 * (ARCHITECTURE.md §5: SSE not WebSocket). Streams real `jobs` lifecycle +
 * `proof_records` rows for the job's agentId (services/hire.ts), then
 * closes — no fabricated future ticks.
 */
jobsRouter.get('/jobs/:id/events', async (c) => {
  const id = c.req.param('id')
  return streamSSE(c, async (stream) => {
    for await (const event of streamJobEvents(id)) {
      await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
    }
  })
})
