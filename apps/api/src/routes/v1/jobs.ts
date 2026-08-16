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
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { createJob, fundJob, revokeJob, streamJobEvents } from '../../services/hire.js'

export const jobsRouter = new Hono()

const createJobBodySchema = z.object({
  agentId: z.string().min(1),
  hirerAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'must be a 0x-prefixed 20-byte EVM address'),
  config: z.object({
    amountUsd1: z.number().nonnegative(),
    spendCap: z.number().nonnegative(),
    durationDays: z.number().int().positive(),
    allowlist: z.array(z.string()),
    triggers: z.record(z.string(), z.unknown()).optional(),
  }),
})

/** POST /v1/jobs — ERD.md §4, creates job intent + Altana session params. Wallet sig required in Phase B. */
jobsRouter.post('/jobs', zValidator('json', createJobBodySchema), async (c) => {
  const body = c.req.valid('json')
  const job = await createJob(body)
  return c.json({ data: job }, 201)
})

/** POST /v1/jobs/:id/fund — ERD.md §4, escrow funding via I4 (Altana hireErc8183Agent). */
jobsRouter.post('/jobs/:id/fund', async (c) => {
  const id = c.req.param('id')
  const job = await fundJob(id)
  if (!job) {
    return c.json({ error: 'not_implemented', message: 'escrow funding — Phase B', jobId: id }, 501)
  }
  return c.json({ data: job })
})

/** POST /v1/jobs/:id/revoke — ERD.md §4, Keystore revoke tx (1 tx, in-product). */
jobsRouter.post('/jobs/:id/revoke', async (c) => {
  const id = c.req.param('id')
  const job = await revokeJob(id)
  if (!job) {
    return c.json(
      { error: 'not_implemented', message: 'session revocation — Phase B', jobId: id },
      501,
    )
  }
  return c.json({ data: job })
})

/**
 * GET /v1/jobs/:id/events — ERD.md §4, SSE dashboard live feed
 * (ARCHITECTURE.md §5: SSE not WebSocket). Stub stream opens and stays
 * connected but never emits — services/hire.ts's streamJobEvents is a no-op
 * generator until the keeper/chain event source is wired (Phase B).
 */
jobsRouter.get('/jobs/:id/events', async (c) => {
  const id = c.req.param('id')
  return streamSSE(c, async (stream) => {
    for await (const event of streamJobEvents(id)) {
      await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
    }
  })
})
