/**
 * apps/api/src/services/altana.ts
 *
 * Altana integration — agent-owned wallets, scoped sessions, public Keystore,
 * `hireErc8183Agent`, in-product revocation (INTEGRATION.md I6). This is the
 * ONLY place that should call the Altana SDK/API. CLAUDE.md rule 1: we do
 * not build our own session/escrow logic — we call Altana's.
 *
 * NOT LIVE THIS SESSION: no ALTANA_API_KEY provisioned. Every function below
 * has the real signature the hire flow needs (per ARCHITECTURE.md §4.2 steps
 * 2-3 and INTEGRATION.md I6's three layers) but returns stub data.
 *
 * TODO(Phase B):
 *  - createScopedSession(): call Altana SDK to register a session in the
 *    public Keystore (allowlist, spend cap, expiry); mirror to `sessions`.
 *  - hireErc8183Agent(): Altana's ERC-8183 helper — funds escrow. This is an
 *    explicit Altana-track bonus criterion; do not reimplement escrow.
 *  - revokeSession(): 1-tx Keystore revoke, must be idempotent/retryable per
 *    CLAUDE.md rule 6 (session-creation/revocation is the riskiest UX moment).
 *  - permissionSentence(): renders the actual session config as the Trust
 *    Panel's plain-language sentence — must never diverge from the chain
 *    (bnb-agent-stack skill: "if the chain and the sentence disagree, that's
 *    a P0 bug").
 */
import type { Session } from '../types/domain.js'

export interface CreateScopedSessionInput {
  agentId: string
  jobId: string
  ownerAddress: string
  allowlist: string[]
  spendCapUsd1: number
  durationDays: number
}

export async function createScopedSession(input: CreateScopedSessionInput): Promise<Session> {
  const expiresAt = new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000).toISOString()
  return {
    id: 'stub-session-1',
    jobId: input.jobId,
    agentId: input.agentId,
    allowlist: input.allowlist,
    spendCapUsd1: input.spendCapUsd1,
    expiresAt,
    revokedAt: null,
    keystoreTx: null,
  }
}

export interface HireErc8183Result {
  escrowRef: string
  fundedTx: string | null
}

/** Altana's ERC-8183 hiring helper — Altana-track bonus criterion. Not called live this session. */
export async function hireErc8183Agent(
  _agentId: string,
  _sessionId: string,
): Promise<HireErc8183Result | null> {
  return null
}

export async function revokeSession(
  sessionId: string,
): Promise<{ revokedAt: string; tx: string | null } | null> {
  void sessionId
  return null
}

/**
 * Plain-language Trust Panel sentence from an actual session config — never
 * from anything other than the session object itself (no paraphrasing of
 * agent-reported claims).
 */
export function permissionSentence(
  session: Pick<Session, 'allowlist' | 'spendCapUsd1' | 'expiresAt'>,
): string {
  const scope = session.allowlist.length > 0 ? session.allowlist.join(', ') : 'nothing yet'
  const expiry = new Date(session.expiresAt).toLocaleDateString()
  return `Can trade ${scope}, up to $${session.spendCapUsd1.toFixed(2)}/day, until ${expiry}.`
}
