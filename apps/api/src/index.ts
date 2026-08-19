/**
 * apps/api/src/index.ts
 *
 * Entry point — Hono on Node 22 (ARCHITECTURE.md §2 "Web vs API split":
 * always-on Node service, not serverless, so SSE/indexer loops can live
 * here). Deploys to Railway (ARCHITECTURE.md §5).
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { pingDatabase } from './db/client.js'
import { env, integrationConfigured } from './env.js'
import { logger } from './logger.js'
import { v1Router } from './routes/v1/index.js'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: env.NEXT_PUBLIC_API_URL ? [env.NEXT_PUBLIC_API_URL] : '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
)

app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  logger.info(
    { method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start },
    'request',
  )
})

/**
 * GET /api/health — uptime probe (ARCHITECTURE.md §6: "/api/health checks
 * DB + RPC + 8004scan"). Never throws, never blocks on unconfigured
 * integrations — no external network calls are made this session (Wave 1B
 * scope), so bscRpc/scan8004/altana report "unconfigured" rather than being
 * probed live. DB gets an actual liveness check IF DATABASE_URL is set,
 * with its own short timeout so a DB hiccup degrades this response instead
 * of hanging it.
 */
app.get('/api/health', async (c) => {
  const db = await pingDatabase()

  const checks = {
    database: db.configured
      ? db.ok
        ? { status: 'ok' as const, latencyMs: db.latencyMs }
        : { status: 'error' as const, error: db.error }
      : { status: 'unconfigured' as const },
    bscRpc: integrationConfigured.bscRpc || integrationConfigured.bscTestnetRpc
      ? { status: 'configured' as const } // TODO(Phase B): live RPC probe via circuit breaker
      : { status: 'unconfigured' as const },
    scan8004: integrationConfigured.scan8004
      ? { status: 'configured' as const } // TODO(Phase B): live probe
      : { status: 'unconfigured' as const },
    altana: integrationConfigured.altana
      ? { status: 'configured' as const }
      : { status: 'unconfigured' as const },
  }

  const overall = checks.database.status === 'error' ? 'degraded' : 'ok'

  return c.json(
    {
      status: overall,
      service: 'agentdesk-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      checks,
    },
    overall === 'ok' ? 200 : 503,
  )
})

app.route('/v1', v1Router)

app.notFound((c) => c.json({ error: 'not_found', path: c.req.path }, 404))

app.onError((err, c) => {
  // Hono itself throws HTTPException (e.g. "Malformed JSON in request body"
  // from zValidator's JSON parse step) with its own intended status —
  // previously this branch always forced 500, turning a client-side bad
  // request into a false server error. Honor the exception's status/response
  // instead (found live during QA).
  if (err instanceof HTTPException) {
    logger.warn({ err: err.message, status: err.status, path: c.req.path }, 'client error')
    return err.getResponse()
  }
  logger.error({ err, path: c.req.path }, 'unhandled error')
  return c.json({ error: 'internal_error' }, 500)
})

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`AgentDesk API listening on http://localhost:${info.port}`)
})

export default app
