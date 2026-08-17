/**
 * apps/api/src/services/session-store.ts
 *
 * Postgres-backed CRUD for the `sessions` table (ERD.md §2/§4) — the
 * self-hosted stand-in for Altana's scoped-session Keystore (INTEGRATION.md
 * I6). See that section's honesty note: Altana SDK access is pending
 * partner onboarding this session; this implements the SAME shape
 * (allowlist, spend cap, expiry, revoke) enforced against the real
 * ProofLedger contract, but it is AgentDesk's own backend logic, not
 * Altana's Keystore. Every wire response from this module carries
 * `enforcedBy: 'agentdesk-self-hosted'` so it can never be mistaken for a
 * real Keystore attestation (CLAUDE.md rule 3/6).
 *
 * Scope this wave (per task brief): allowlist is fixed-shape — exactly one
 * entry, ProofLedger.registerDecision for a single agentId. No on-chain
 * spend-cap enforcement exists (ProofLedger has no concept of spend caps —
 * see SMART-CONTRACT.md); spendCapUsd1 is stored and rendered honestly as
 * *not* chain-enforced.
 *
 * FK note: `sessions.jobId` is NOT NULL and ERD.md §3 fixes a 1:1
 * job↔session cardinality, but services/hire.ts's real hire flow (job
 * creation via Altana's hireErc8183Agent) is unwired this wave (no
 * ALTANA_API_KEY). createSession() below inserts a minimal companion `jobs`
 * row purely to satisfy that FK/cardinality — NOT a real ERC-8183 escrow.
 * That row is never read by any other route (jobs.ts's own handlers are
 * still stubs that don't touch the DB), so this cannot leak a fabricated
 * job into anything user-facing. Flagged here + INTEGRATION.md I6 so a
 * future wave wiring up services/hire.ts for real doesn't get confused by
 * pre-existing synthetic rows.
 */
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { agents, jobs, sessions } from '../db/schema.js'
import { getProofLedgerAddress } from '../lib/chain.js'

export const ENFORCED_BY = 'agentdesk-self-hosted' as const

/** Chapel testnet — the only network this wave's sessions are scoped to (see chain.ts). */
const SESSION_CHAIN_ID = 97

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('sessions: DATABASE_URL not configured — cannot read/write real session state')
    this.name = 'DatabaseNotConfiguredError'
  }
}

function requireDb() {
  const db = getDb()
  if (!db) throw new DatabaseNotConfiguredError()
  return db
}

export interface SessionAllowlistEntry {
  label: string
  contract: 'ProofLedger'
  contractAddress: string
  function: 'registerDecision'
  agentId: string
  chainId: number
}

export interface CreateSessionInput {
  agentId: string
  ownerAddress: string
  spendCapUsd1: number
  durationDays: number
}

/** Wire shape returned by every route in sessions.ts — always self-hosted-labeled. */
export interface SessionWire {
  id: string
  jobId: string
  agentId: string
  allowlist: SessionAllowlistEntry[]
  spendCapUsd1: number
  expiresAt: string
  revokedAt: string | null
  keystoreTx: string | null
  enforcedBy: typeof ENFORCED_BY
  onChainSpendCapEnforced: false
}

/**
 * Exported (2026-08-17) so services/hire.ts's real Altana session flow can
 * reuse the exact same `sessions.allowlist` jsonb SHAPE (label/contract/
 * contractAddress/function/agentId/chainId) for real Altana job sessions —
 * NOT the renderPermissionSentence() text below, which is self-hosted-
 * specific language ("Enforced by AgentDesk's self-hosted session backend
 * ... not an Altana Keystore session") that would be actively WRONG for a
 * real Altana session. hire.ts renders its own honest sentence instead.
 */
export function buildAllowlist(agentId: string): SessionAllowlistEntry[] {
  return [
    {
      label: `Register trading decisions for agent #${agentId} on ProofLedger`,
      contract: 'ProofLedger',
      contractAddress: getProofLedgerAddress(),
      function: 'registerDecision',
      agentId,
      chainId: SESSION_CHAIN_ID,
    },
  ]
}

function toWire(row: typeof sessions.$inferSelect): SessionWire {
  const allowlist = Array.isArray(row.allowlist) ? (row.allowlist as SessionAllowlistEntry[]) : []
  return {
    id: row.id,
    jobId: row.jobId,
    agentId: row.agentId,
    allowlist,
    spendCapUsd1: row.spendCapUsd1 === null ? 0 : Number(row.spendCapUsd1),
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : '',
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
    keystoreTx: row.keystoreTx,
    enforcedBy: ENFORCED_BY,
    onChainSpendCapEnforced: false,
  }
}

/**
 * Creates a scoped session: ensures a placeholder `agents` row exists (FK
 * anchor only — never surfaced by GET /v1/agents, which reads exclusively
 * from services/scan8004.ts, still unwired this wave), inserts a minimal
 * companion `jobs` row (see file banner), then the real `sessions` row.
 */
export async function createSession(input: CreateSessionInput): Promise<SessionWire> {
  const db = requireDb()

  await db
    .insert(agents)
    .values({
      id: input.agentId,
      ownerAddress: input.ownerAddress,
      chainId: SESSION_CHAIN_ID,
      syncSource: 'agentdesk-demo-seed', // NOT '8004scan'/'registry' — flags this row as a local FK anchor, not a real synced identity
    })
    .onConflictDoNothing()

  const [job] = await db
    .insert(jobs)
    .values({
      agentId: input.agentId,
      hirerAddress: input.ownerAddress,
      config: {
        note: 'synthetic companion row for sessions FK — see session-store.ts banner',
        amountUsd1: 0,
        spendCap: input.spendCapUsd1,
        durationDays: input.durationDays,
        allowlist: buildAllowlist(input.agentId).map((e) => e.label),
        triggers: {},
      },
      status: 'created',
      feeUsd1: '0',
    })
    .returning()

  if (!job) throw new Error('sessions: failed to insert companion job row')

  const expiresAt = new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000)

  const [row] = await db
    .insert(sessions)
    .values({
      id: `sess_${randomUUID()}`,
      jobId: job.id,
      agentId: input.agentId,
      allowlist: buildAllowlist(input.agentId),
      spendCapUsd1: input.spendCapUsd1.toFixed(2),
      expiresAt,
      revokedAt: null,
      keystoreTx: null,
    })
    .returning()

  if (!row) throw new Error('sessions: failed to insert session row')
  return toWire(row)
}

export async function getSession(id: string): Promise<SessionWire | null> {
  const db = requireDb()
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
  return row ? toWire(row) : null
}

/** Idempotent — revoking an already-revoked session returns its existing (unchanged) revokedAt. */
export async function revokeSession(id: string): Promise<SessionWire | null> {
  const db = requireDb()
  const existing = await getSession(id)
  if (!existing) return null
  if (existing.revokedAt) return existing // already revoked — no-op, not an error

  const [row] = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, id)))
    .returning()

  if (!row) return null
  return toWire(row)
}

/**
 * The Trust Panel sentence — rendered ONLY from the actual session row,
 * honest about both the self-hosted enforcement boundary and the absence of
 * on-chain spend-cap enforcement (task brief's explicit non-negotiable).
 */
export function renderPermissionSentence(session: SessionWire): string {
  if (session.allowlist.length === 0) {
    return 'This session has no permissions granted.'
  }
  const scope = session.allowlist.map((e) => e.label).join('; ')
  const expiry = session.expiresAt
    ? new Date(session.expiresAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'an unset date'

  if (session.revokedAt) {
    const revokedOn = new Date(session.revokedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return `Revoked on ${revokedOn} — this session can no longer register decisions (was: ${scope}, up to $${session.spendCapUsd1.toFixed(2)} spend cap, until ${expiry}). Enforced by AgentDesk's self-hosted session backend, not Altana Keystore.`
  }

  const now = new Date()
  const isExpired = session.expiresAt ? new Date(session.expiresAt) <= now : true
  const status = isExpired ? 'Expired — no longer usable.' : 'Active.'

  return (
    `${status} Can ${scope.charAt(0).toLowerCase()}${scope.slice(1)}, until ${expiry}. ` +
    `Spend cap $${session.spendCapUsd1.toFixed(2)} is tracked but NOT enforced on-chain ` +
    `(ProofLedger has no spend-cap concept). Enforced by AgentDesk's self-hosted session ` +
    `backend against the real ProofLedger contract — not an Altana Keystore session.`
  )
}
