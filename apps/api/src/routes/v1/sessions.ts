/**
 * apps/api/src/routes/v1/sessions.ts
 *
 * Self-hosted scoped-session mirror — backs the Trust Panel (INTEGRATION.md
 * I6, bnb-agent-stack skill: "the plain-language permission sentences
 * render from the actual session config"). Real Altana SDK access is
 * pending partner onboarding this session (see INTEGRATION.md I6's honesty
 * note); every response below carries `enforcedBy: 'agentdesk-self-hosted'`
 * so it can never be mistaken for a real Altana Keystore session
 * (CLAUDE.md rule 3/6 — never present an unverifiable claim as verified).
 *
 * Wired to the real `sessions` table this wave (was previously a
 * documented 404 stub — see git history). ERD.md §4's API table did not
 * previously list a standalone /v1/sessions path; this file's routes are
 * now folded into that table in the same commit.
 *
 * Path note: mounted at the /v1 ROOT in routes/v1/index.ts.
 */
import { AddressSchema, AgentIdSchema, Hex32Schema } from '@agentdesk/sdk'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Hex } from 'viem'
import { z } from 'zod'
import {
  type EnforcementRefusalReason,
  registerDecisionThroughSession,
} from '../../services/session-enforcement.js'
import {
  createSession,
  DatabaseNotConfiguredError,
  getSession,
  renderPermissionSentence,
  revokeSession,
} from '../../services/session-store.js'

export const sessionsRouter = new Hono()

const refusalStatus: Record<EnforcementRefusalReason, 200 | 400 | 404 | 503> = {
  session_not_found: 404,
  session_revoked: 400,
  session_expired: 400,
  not_allowlisted: 400,
  chain_not_configured: 503,
}

/**
 * POST /v1/sessions — create a scoped session, allowlisted (this wave) to
 * exactly one call: ProofLedger.registerDecision for the given agentId.
 * Spend cap is stored and rendered but NOT enforced on-chain — ProofLedger
 * has no spend-cap concept (see session-store.ts renderPermissionSentence).
 */
const createSessionBodySchema = z.object({
  agentId: AgentIdSchema,
  ownerAddress: AddressSchema,
  spendCapUsd1: z.number().nonnegative(),
  durationDays: z.number().int().positive().max(365),
})

sessionsRouter.post('/sessions', zValidator('json', createSessionBodySchema), async (c) => {
  const body = c.req.valid('json')
  try {
    const session = await createSession(body)
    return c.json({ data: session }, 201)
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) {
      return c.json({ error: 'database_not_configured', message: err.message }, 503)
    }
    throw err
  }
})

/** GET /v1/sessions/:id — real session row (allowlist, spend cap, expiry, revoked_at). */
sessionsRouter.get('/sessions/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const session = await getSession(id)
    if (!session) return c.json({ error: 'session_not_found', sessionId: id }, 404)
    return c.json({ data: session })
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) {
      return c.json({ error: 'database_not_configured', message: err.message }, 503)
    }
    throw err
  }
})

/**
 * GET /v1/sessions/:id/permission-sentence — the real Trust Panel sentence,
 * derived only from the session row (never paraphrased from agent-reported
 * claims). Includes the same `enforcedBy` marker as the raw session object.
 */
sessionsRouter.get('/sessions/:id/permission-sentence', async (c) => {
  const id = c.req.param('id')
  try {
    const session = await getSession(id)
    if (!session) return c.json({ error: 'session_not_found', sessionId: id }, 404)
    return c.json({
      data: {
        sessionId: session.id,
        sentence: renderPermissionSentence(session),
        enforcedBy: session.enforcedBy,
        onChainSpendCapEnforced: session.onChainSpendCapEnforced,
      },
    })
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) {
      return c.json({ error: 'database_not_configured', message: err.message }, 503)
    }
    throw err
  }
})

/** POST /v1/sessions/:id/revoke — real revoke: sets sessions.revoked_at. Idempotent. */
sessionsRouter.post('/sessions/:id/revoke', async (c) => {
  const id = c.req.param('id')
  try {
    const session = await revokeSession(id)
    if (!session) return c.json({ error: 'session_not_found', sessionId: id }, 404)
    return c.json({ data: session })
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) {
      return c.json({ error: 'database_not_configured', message: err.message }, 503)
    }
    throw err
  }
})

/**
 * POST /v1/sessions/:id/decisions — the "agent runner" path: attempts a
 * real ProofLedger.registerDecision call gated by session-enforcement.ts.
 * Refused calls (revoked/expired/not-allowlisted) return before the chain
 * is ever touched — this is the actual point of the mechanism (task brief).
 * Not in ERD.md's original API sketch; added + documented there this wave.
 */
const registerDecisionBodySchema = z.object({
  intentHash: Hex32Schema,
  /** Seconds from now until the decision's deadline; contract requires <= MAX_WINDOW (24h). */
  windowSeconds: z
    .number()
    .int()
    .positive()
    .max(24 * 60 * 60)
    .default(300),
})

sessionsRouter.post(
  '/sessions/:id/decisions',
  zValidator('json', registerDecisionBodySchema),
  async (c) => {
    const id = c.req.param('id')
    const body = c.req.valid('json')
    try {
      const session = await getSession(id)
      if (!session) return c.json({ error: 'session_not_found', sessionId: id }, 404)

      const deadline = Math.floor(Date.now() / 1000) + body.windowSeconds
      const result = await registerDecisionThroughSession(id, {
        agentId: session.agentId,
        intentHash: body.intentHash as Hex,
        deadline,
      })

      if (!result.ok) {
        return c.json(
          { error: result.reason, message: result.message, enforcedBy: session.enforcedBy },
          refusalStatus[result.reason],
        )
      }
      return c.json({
        data: {
          sessionId: id,
          agentId: session.agentId,
          txHash: result.txHash,
          recordId: result.recordId,
          blockNumber: result.blockNumber,
          enforcedBy: session.enforcedBy,
        },
      })
    } catch (err) {
      if (err instanceof DatabaseNotConfiguredError) {
        return c.json({ error: 'database_not_configured', message: err.message }, 503)
      }
      throw err
    }
  },
)
