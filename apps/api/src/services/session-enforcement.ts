/**
 * apps/api/src/services/session-enforcement.ts
 *
 * The "agent runner" enforcement gate: given a session id + an intended
 * ProofLedger.registerDecision call, reads the REAL session row from
 * Postgres (via session-store.ts) and only submits the real on-chain tx if
 * the session is unrevoked, unexpired, and the call is on its allowlist.
 * Refused calls never touch the chain (task brief's non-negotiable proof
 * point: revocation has real teeth).
 *
 * This is the self-hosted stand-in for what an Altana session key would
 * enforce (INTEGRATION.md I6 honesty note) — signs with
 * DEMO_AGENT_PRIVATE_KEY (apps/api/.env.demo-agent), a fresh key with no
 * on-chain role, since registerDecision has no access control
 * (SMART-CONTRACT.md). It is NOT KEEPER_ATTESTER_KEY and NOT an Altana
 * session key.
 */
import { proofLedgerAbi } from '@agentdesk/sdk'
import type { Hex } from 'viem'
import { getDemoAgentWalletClient, getProofLedgerAddress, getPublicClient } from '../lib/chain.js'
import { logger } from '../logger.js'
import { getSession, type SessionWire } from './session-store.js'

export type EnforcementRefusalReason =
  | 'session_not_found'
  | 'session_revoked'
  | 'session_expired'
  | 'not_allowlisted'
  | 'chain_not_configured'

export interface EnforcementRefusal {
  ok: false
  reason: EnforcementRefusalReason
  message: string
}

export interface EnforcementSuccess {
  ok: true
  txHash: Hex
  recordId: string
  blockNumber: string
}

export interface RegisterDecisionRequest {
  agentId: string
  intentHash: Hex
  /** Unix seconds. */
  deadline: number
}

function refuse(reason: EnforcementRefusalReason, message: string): EnforcementRefusal {
  logger.warn({ reason }, `session-enforcement: refused before touching chain — ${message}`)
  return { ok: false, reason, message }
}

/** Pure check — no chain/DB access — so route handlers and tests can reason about it in isolation. */
export function checkSessionPermits(
  session: SessionWire,
  request: Pick<RegisterDecisionRequest, 'agentId'>,
): EnforcementRefusal | { ok: true } {
  if (session.revokedAt) {
    return refuse(
      'session_revoked',
      `session ${session.id} was revoked at ${session.revokedAt} — refusing before any chain call`,
    )
  }
  const expiresAt = session.expiresAt ? new Date(session.expiresAt) : null
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return refuse(
      'session_expired',
      `session ${session.id} expired at ${session.expiresAt ?? 'unset'} — refusing before any chain call`,
    )
  }
  const allowed = session.allowlist.some(
    (entry) =>
      entry.contract === 'ProofLedger' &&
      entry.function === 'registerDecision' &&
      entry.agentId === request.agentId,
  )
  if (!allowed) {
    return refuse(
      'not_allowlisted',
      `session ${session.id} does not allow registerDecision for agent #${request.agentId} — refusing before any chain call`,
    )
  }
  return { ok: true }
}

/**
 * The full gate: load the real session row, check it, and ONLY if permitted
 * submit the real registerDecision tx to Chapel. Every refusal path returns
 * before getDemoAgentWalletClient()/getPublicClient() is even called.
 */
export async function registerDecisionThroughSession(
  sessionId: string,
  request: RegisterDecisionRequest,
): Promise<EnforcementRefusal | EnforcementSuccess> {
  const session = await getSession(sessionId)
  if (!session) {
    return refuse('session_not_found', `no session found for id ${sessionId}`)
  }

  const permission = checkSessionPermits(session, request)
  if (!permission.ok) return permission

  // Permitted — now, and only now, do we touch the chain.
  let publicClient: Awaited<ReturnType<typeof getPublicClient>>
  let address: ReturnType<typeof getProofLedgerAddress>
  try {
    address = getProofLedgerAddress()
    publicClient = await getPublicClient()
  } catch (err) {
    return refuse(
      'chain_not_configured',
      err instanceof Error ? err.message : 'chain not configured',
    )
  }

  const walletClient = await getDemoAgentWalletClient()
  const account = walletClient.account
  if (!account) throw new Error('session-enforcement: demo-agent wallet client has no account')

  const { request: simulated, result: recordId } = await publicClient.simulateContract({
    address,
    abi: proofLedgerAbi,
    functionName: 'registerDecision',
    args: [BigInt(request.agentId), request.intentHash, BigInt(request.deadline)],
    account,
  })

  const txHash = await walletClient.writeContract(simulated)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  logger.info(
    {
      sessionId,
      agentId: request.agentId,
      recordId: recordId.toString(),
      txHash,
      blockNumber: receipt.blockNumber.toString(),
    },
    'session-enforcement: registerDecision submitted through permitted session',
  )

  return {
    ok: true,
    txHash,
    recordId: recordId.toString(),
    blockNumber: receipt.blockNumber.toString(),
  }
}
