/**
 * apps/api/src/routes/v1/index.ts
 *
 * Mounts the domain routers at the /v1 root. Each router defines its own full
 * paths (see per-file headers) so the combined surface matches ERD.md §4's
 * API table exactly, even though the files are split by domain rather than by
 * URL prefix.
 */
import { Hono } from 'hono'
import { agentsRouter } from './agents.js'
import { jobsRouter } from './jobs.js'
import { proofRouter } from './proof.js'
import { sessionsRouter } from './sessions.js'
import { faucetRouter } from './faucet.js'

export const v1Router = new Hono()

v1Router.route('/', agentsRouter)
v1Router.route('/', proofRouter)
v1Router.route('/', jobsRouter)
v1Router.route('/', sessionsRouter)
v1Router.route('/', faucetRouter)
