/**
 * apps/api/src/services/hire.ts
 *
 * Job lifecycle (ERC-8183 escrow, mirrored to `jobs`/`sessions`) per
 * ARCHITECTURE.md §4.2 hire sequence and ERD.md §4 API surface. This service
 * never implements its own escrow — it orchestrates calls into
 * services/altana.ts (`createAgentWallet`/`createScopedSession`/
 * `hireErc8183Agent`/`revokeSession`) and mirrors resulting state into
 * Postgres. CLAUDE.md rule 1: do not write custom escrow/identity/payments
 * code here.
 *
 * LIVE (2026-08-17): every function below is real —
 *  - createJob(): real `jobs` row (status='created') + a REAL fresh Altana
 *    wallet (services/altana.ts createAgentWallet), funded with tBNB from
 *    the Chapel deployer key, granted a REAL KeyStore-registered scoped
 *    session (createScopedSession), mirrored into a real `sessions` row.
 *  - fundJob(): calls the real `hireErc8183Agent()` — expected to hit the
 *    documented $U wall (INTEGRATION.md I4: Ownable, no public mint/faucet)
 *    and sets status='pending_funding' with an honest reason, never a fake
 *    'funded'.
 *  - revokeJob(): calls the real `revokeSession()` (1-tx Keystore revoke),
 *    updates `sessions.revoked_at` + `jobs.status='revoked'` for real.
 *  - streamJobEvents(): reads real `proof_records` rows for the job's
 *    agentId (no jobId column on the generic `events` table — see ERD.md
 *    §2 — so proof_records is the genuinely real, simpler source here).
 *
 * KNOWN LIMITATION (inherited from altana.ts): granted Altana sessions live
 * only in that module's in-process Map — a process restart between
 * createJob() and revokeJob()/fundJob() means the session's key material is
 * gone and revokeJob() will honestly refuse (SessionNotLiveError) rather
 * than fake a revoke. This is a real follow-up (needs the session's raw key
 * material NEVER persisted to Postgres in plaintext — that's deliberate),
 * not a silent gap.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { HireConfig } from '@agentdesk/sdk'
import dotenv from 'dotenv'
import { asc, eq } from 'drizzle-orm'
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'
import {
  createAgentWallet,
  createScopedSession,
  ERC8183_ADDRESSES,
  hireErc8183Agent as altanaHireErc8183Agent,
  revokeSession as altanaRevokeSession,
} from './altana.js'
import { getDb } from '../db/client.js'
import { agents, jobs, proofRecords, sessions } from '../db/schema.js'
import { env } from '../env.js'
import { logger } from '../logger.js'
import { buildAllowlist, DatabaseNotConfiguredError, type SessionAllowlistEntry } from './session-store.js'
import type { Job, JobStatus, Session } from '../types/domain.js'

export { DatabaseNotConfiguredError }

/** Chapel testnet — the only network this flow is scoped to (matches session-store.ts). */
const SESSION_CHAIN_ID = 97

/** Enough for register:true KeyStore registration + grant + a fund attempt + revoke + one refused post-revoke call. Matches scripts/altana-live-proof.ts's budget. */
const FUND_AMOUNT_WEI = parseEther('0.02')

/**
 * A real ERC-8004-registered address, confirmed live on Chapel (chain 97)
 * via a direct 8004scan query — INTEGRATION.md I4 "RE-CHECKED" note
 * ("Tianquan Gateway", not owned by our own team). Used ONLY as the
 * `provider` argument to the real `hireErc8183Agent()` call in fundJob() so
 * that call is never made against a fabricated counterparty — the call is
 * still expected to fail at the real $U wall, which has nothing to do with
 * this address's validity.
 */
const KNOWN_REAL_ERC8004_PROVIDER = '0x816cbc5e8bb7c722f0329afee554d0e148959cee' as const

export interface CreateJobInput {
  agentId: string
  hirerAddress: string
  config: HireConfig
}

function requireDb() {
  const db = getDb()
  if (!db) throw new DatabaseNotConfiguredError()
  return db
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * The real granted scope for a job's session: session-store.ts's
 * ProofLedger row (shared shape, buildAllowlist) plus a second row
 * describing the whole-contract Erc8183.hire grant (altana.ts
 * buildCallPermissions) — kept in sync with the exact allowlist passed to
 * createScopedSession() in createJob() below so `sessions.allowlist` never
 * under-describes what was actually granted on-chain.
 */
function buildJobSessionAllowlist(agentId: string): (SessionAllowlistEntry | Record<string, unknown>)[] {
  const addresses = ERC8183_ADDRESSES[SESSION_CHAIN_ID]
  const erc8183Row = addresses
    ? {
        label: 'Fund ERC-8183 hire jobs (create, register, budget, approve $U, fund) via Altana',
        contract: 'Erc8183',
        contractAddresses: { commerce: addresses.commerce, paymentToken: addresses.paymentToken },
        function: '*', // whole-contract scope on both addresses — see altana.ts buildCallPermissions
        agentId,
        chainId: SESSION_CHAIN_ID,
      }
    : null
  return erc8183Row ? [...buildAllowlist(agentId), erc8183Row] : buildAllowlist(agentId)
}

// ---------------------------------------------------------------------------
// Row <-> wire mapping
// ---------------------------------------------------------------------------

function toJob(
  row: typeof jobs.$inferSelect,
  session: Session | null,
  sessionError: string | null,
  fundingBlockedReason: string | null,
): Job {
  return {
    id: row.id,
    escrowRef: row.escrowRef,
    agentId: row.agentId,
    hirerAddress: row.hirerAddress,
    config: (row.config ?? {}) as HireConfig,
    status: row.status as JobStatus,
    feeUsd1: row.feeUsd1 === null ? 0 : Number(row.feeUsd1),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    session,
    sessionError,
    fundingBlockedReason,
  }
}

function toSession(row: typeof sessions.$inferSelect): Session {
  const allowlist = Array.isArray(row.allowlist)
    ? (row.allowlist as SessionAllowlistEntry[]).map((e) => e.label)
    : []
  return {
    id: row.id,
    jobId: row.jobId,
    agentId: row.agentId,
    allowlist,
    spendCapUsd1: row.spendCapUsd1 === null ? 0 : Number(row.spendCapUsd1),
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : '',
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
    keystoreTx: row.keystoreTx,
  }
}

/** `jobs.id` is a Postgres `uuid` column — a non-UUID-shaped id must never
 * reach the query (Postgres throws `invalid input syntax for type uuid`,
 * which previously surfaced as an unhandled 500 instead of the intended
 * `job_not_found` 404 — found live during QA, see docs/technical hand-off
 * notes). Short-circuit to "not found" instead, same effect as a real
 * miss, since a malformed id can never match a row either way. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getJobRow(db: ReturnType<typeof requireDb>, jobId: string) {
  if (!UUID_RE.test(jobId)) return null
  const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
  return row ?? null
}

async function getSessionRowByJobId(db: ReturnType<typeof requireDb>, jobId: string) {
  const [row] = await db.select().from(sessions).where(eq(sessions.jobId, jobId)).limit(1)
  return row ?? null
}

// ---------------------------------------------------------------------------
// Deployer-funded gas for fresh per-job Altana wallets
// (mirrors scripts/altana-live-proof.ts's funding step exactly — same
// scoped, never-printed env read; deployer key never leaves this process)
// ---------------------------------------------------------------------------

function readDeployerPrivateKey(): `0x${string}` {
  const deployerEnvPath = resolve(
    import.meta.dirname,
    '..',
    '..',
    '..',
    '..',
    'packages',
    'contracts',
    '.env.chapel-deploy',
  )
  const parsed = dotenv.parse(readFileSync(deployerEnvPath, 'utf8'))
  const key = parsed.PRIVATE_KEY
  if (!key) throw new Error('hire: packages/contracts/.env.chapel-deploy has no PRIVATE_KEY')
  return key as `0x${string}`
}

async function fundAgentWallet(address: `0x${string}`, amountWei: bigint): Promise<`0x${string}`> {
  if (!env.BSC_TESTNET_RPC_URL) {
    throw new Error('hire: BSC_TESTNET_RPC_URL not configured — cannot fund a fresh Altana wallet')
  }
  const deployerPrivateKey = readDeployerPrivateKey()
  const publicClient = createPublicClient({ chain: bscTestnet, transport: http(env.BSC_TESTNET_RPC_URL) })
  const deployerAccount = privateKeyToAccount(deployerPrivateKey)
  const deployerBalance = await publicClient.getBalance({ address: deployerAccount.address })
  if (deployerBalance < amountWei) {
    throw new Error(
      `hire: Chapel deployer balance (${deployerBalance} wei) is below the funding amount (${amountWei} wei) — cannot fund fresh Altana wallet`,
    )
  }
  const walletClient = createWalletClient({
    chain: bscTestnet,
    account: deployerAccount,
    transport: http(env.BSC_TESTNET_RPC_URL),
  })
  const txHash = await walletClient.sendTransaction({ to: address, value: amountWei })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  if (receipt.status !== 'success') {
    throw new Error(`hire: funding tx ${txHash} did not succeed (status=${receipt.status})`)
  }
  return txHash
}

/**
 * Persists a fresh per-job Altana wallet's private key to a NEW gitignored
 * file (mirrors apps/api/.env.altana-agent's exact pattern — same
 * `.env.*` gitignore rule) BEFORE any funding/spend, so a failed later step
 * never strands recoverable tBNB behind a lost in-memory-only key. Session
 * key details are appended once granted, same as scripts/altana-live-proof.ts.
 */
function persistJobWalletKey(jobId: string, address: string, privateKey: string): string {
  const outPath = resolve(import.meta.dirname, '..', '..', `.env.altana-job-${jobId}`)
  writeFileSync(
    outPath,
    [
      `# apps/api/.env.altana-job-${jobId} — GENERATED by services/hire.ts createJob(), gitignored (matches .env.* in root .gitignore)`,
      `# Real, fresh, self-custodial Altana agent wallet for job ${jobId} — generated ${new Date().toISOString()}`,
      `ALTANA_WALLET_ADDRESS=${address}`,
      `ALTANA_WALLET_PRIVATE_KEY=${privateKey}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  )
  return outPath
}

function appendJobSessionInfo(
  outPath: string,
  fields: { publicKey?: string; signerAddress?: string; fundTx: string; grantTx: string | null },
): void {
  appendFileSync(
    outPath,
    [
      `# Session granted for this job.`,
      `ALTANA_FUND_TX=${fields.fundTx}`,
      `ALTANA_SESSION_GRANT_TX=${fields.grantTx ?? '(relay did not report one)'}`,
      fields.publicKey ? `ALTANA_SESSION_PUBLIC_KEY=${fields.publicKey}` : '',
      fields.signerAddress ? `ALTANA_SESSION_SIGNER_ADDRESS=${fields.signerAddress}` : '',
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  )
}

// ---------------------------------------------------------------------------
// Public service functions (consumed by routes/v1/jobs.ts)
// ---------------------------------------------------------------------------

/** Thrown by revokeJob() when the session's key material isn't resident in this process (see file banner "KNOWN LIMITATION") — a real refusal, never a faked revoke. */
export class SessionNotLiveError extends Error {
  constructor(public readonly sessionId: string) {
    super(
      `hire: session ${sessionId}'s key material is not live in this process (in-memory cache — see services/altana.ts) — cannot issue a real revoke; refusing rather than faking success`,
    )
    this.name = 'SessionNotLiveError'
  }
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const db = requireDb()

  // FK anchor row — same pattern as session-store.ts's createSession().
  await db
    .insert(agents)
    .values({
      id: input.agentId,
      ownerAddress: input.hirerAddress,
      chainId: SESSION_CHAIN_ID,
      syncSource: 'agentdesk-hire-flow', // NOT '8004scan'/'registry' — a local FK anchor, not a real synced identity
    })
    .onConflictDoNothing()

  const feeUsd1 = round2((input.config.amountUsd1 * env.PROTOCOL_FEE_BPS) / 10_000)

  const [jobRow] = await db
    .insert(jobs)
    .values({
      agentId: input.agentId,
      hirerAddress: input.hirerAddress,
      config: input.config,
      status: 'created',
      feeUsd1: feeUsd1.toFixed(2),
    })
    .returning()
  if (!jobRow) throw new Error('hire.createJob: failed to insert job row')

  let session: Session | null = null
  let sessionError: string | null = null

  try {
    const agentWallet = await createAgentWallet()
    const keyFilePath = persistJobWalletKey(jobRow.id, agentWallet.address, agentWallet.privateKey)
    logger.info({ jobId: jobRow.id, walletAddress: agentWallet.address, keyFilePath }, 'hire: fresh Altana wallet key persisted (gitignored)')

    const fundTx = await fundAgentWallet(agentWallet.address, FUND_AMOUNT_WEI)
    logger.info({ jobId: jobRow.id, walletAddress: agentWallet.address, fundTx }, 'hire: fresh Altana wallet funded with tBNB from Chapel deployer')

    // Scoped, this wave, to exactly ProofLedger.registerDecision for this
    // agentId — the only call our own contract exposes and that the
    // demo/proof pipeline (scripts/altana-live-proof.ts) has already proven
    // real end-to-end. The HireConfig.allowlist the hirer confirmed
    // (input.config.allowlist — trading-protocol permissions such as
    // PancakeSwap) is persisted verbatim on the `jobs` row for Trust Panel
    // display, but is NOT what's actually granted on-chain this wave — we
    // don't have real router/quoter call signatures wired for those
    // protocols yet. Never silently widen the real grant beyond what's
    // provably safe (CLAUDE.md rule 1/3).
    const grantedSession = await createScopedSession({
      agentId: input.agentId,
      jobId: jobRow.id,
      ownerAddress: input.hirerAddress,
      // ProofLedger.registerDecision = the demo/proof pipeline's proven call.
      // Erc8183.hire = whole-contract scope on the real ERC-8183 commerce +
      // $U contracts (altana.ts buildCallPermissions), so fundJob()'s real
      // hireErc8183Agent() call can actually reach the relay's simulation
      // instead of being refused earlier by our own session's call scope —
      // any failure from there on is the genuine $U wall (INTEGRATION.md I4).
      allowlist: ['ProofLedger.registerDecision', 'Erc8183.hire'],
      spendCapUsd1: input.config.spendCapUsd1,
      durationDays: input.config.durationDays,
      wallet: agentWallet.wallet,
      signer: agentWallet.signer,
    })

    appendJobSessionInfo(keyFilePath, {
      fundTx,
      grantTx: grantedSession.keystoreTx,
    })

    const [sessionRow] = await db
      .insert(sessions)
      .values({
        id: grantedSession.id,
        jobId: jobRow.id,
        agentId: input.agentId,
        allowlist: buildJobSessionAllowlist(input.agentId),
        spendCapUsd1: grantedSession.spendCapUsd1.toFixed(2),
        expiresAt: new Date(grantedSession.expiresAt),
        revokedAt: null,
        keystoreTx: grantedSession.keystoreTx,
      })
      .returning()
    if (!sessionRow) throw new Error('hire.createJob: failed to insert session row')

    session = toSession(sessionRow)
    logger.info(
      { jobId: jobRow.id, sessionId: grantedSession.id, walletAddress: agentWallet.address, keystoreTx: grantedSession.keystoreTx },
      'hire: real Altana wallet + KeyStore-registered scoped session provisioned for job',
    )
  } catch (err) {
    sessionError = err instanceof Error ? err.message : String(err)
    logger.error(
      { jobId: jobRow.id, error: sessionError },
      'hire: real Altana wallet/session provisioning failed — job row persists (status=created), session left null (never fabricated)',
    )
  }

  return toJob(jobRow, session, sessionError, null)
}

async function setFundingBlocked(
  db: ReturnType<typeof requireDb>,
  jobRow: typeof jobs.$inferSelect,
  session: Session | null,
  reason: string,
): Promise<Job> {
  const [updated] = await db
    .update(jobs)
    .set({ status: 'pending_funding', updatedAt: new Date() })
    .where(eq(jobs.id, jobRow.id))
    .returning()
  logger.warn({ jobId: jobRow.id, reason }, 'hire.fundJob: honest pending_funding — never a fake funded')
  return toJob(updated ?? jobRow, session, null, reason)
}

/** Terminal job states — attempting to fund from here must never mutate status (CLAUDE.md: never fake success, and never silently downgrade a terminal state either). */
const NON_FUNDABLE_STATUSES: JobStatus[] = ['revoked', 'completed', 'failed', 'expired']

export async function fundJob(jobId: string): Promise<Job | null> {
  const db = requireDb()
  const jobRow = await getJobRow(db, jobId)
  if (!jobRow) return null

  const sessionRow = await getSessionRowByJobId(db, jobId)
  const session = sessionRow ? toSession(sessionRow) : null

  if (NON_FUNDABLE_STATUSES.includes(jobRow.status as JobStatus)) {
    // Read-only refusal — status is NOT touched. A prior bug here called the
    // real hireErc8183Agent() anyway and, on its (expected) failure, wrote
    // status='pending_funding' over an already-'revoked' job — silently
    // erasing the revocation from the job's own status field. Caught during
    // this wave's own live proof run (see final report); fixed here before
    // handoff.
    return toJob(
      jobRow,
      session,
      null,
      `job is ${jobRow.status} — cannot fund a job in a terminal state`,
    )
  }

  if (!sessionRow) {
    return setFundingBlocked(
      db,
      jobRow,
      null,
      'no Altana session on record for this job — session provisioning must have failed at createJob time (see sessionError on that response)',
    )
  }

  const config = (jobRow.config ?? {}) as HireConfig
  const budgetUsd1 = typeof config.amountUsd1 === 'number' && config.amountUsd1 > 0 ? config.amountUsd1 : 1

  try {
    const result = await altanaHireErc8183Agent(sessionRow.id, {
      provider: KNOWN_REAL_ERC8004_PROVIDER,
      task: `AgentDesk hire — job ${jobRow.id} (agent ${jobRow.agentId})`,
      budgetUsd1,
    })

    if (!result) {
      return setFundingBlocked(
        db,
        jobRow,
        session,
        'altana.hireErc8183Agent: this job\'s session is not live in this process\'s in-memory cache (known limitation — see services/altana.ts) — cannot attempt real funding without it',
      )
    }

    // Reached only if $U were actually available — not expected this wave
    // (INTEGRATION.md I4), but wired honestly rather than assumed away.
    const [updated] = await db
      .update(jobs)
      .set({ status: 'funded', escrowRef: result.escrowRef, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning()
    logger.info(
      { jobId, escrowRef: result.escrowRef, tx: result.fundedTx },
      'hire.fundJob: real hireErc8183Agent succeeded — job genuinely funded',
    )
    return toJob(updated ?? jobRow, session, null, null)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return setFundingBlocked(db, jobRow, session, reason)
  }
}

export async function revokeJob(jobId: string): Promise<Job | null> {
  const db = requireDb()
  const jobRow = await getJobRow(db, jobId)
  if (!jobRow) return null

  const sessionRow = await getSessionRowByJobId(db, jobId)

  if (!sessionRow) {
    // No session was ever granted for this job (createJob's session step
    // must have failed) — nothing to revoke on-chain, but the job itself
    // can still be marked revoked (there is no live grant to leave dangling).
    const [updated] = await db
      .update(jobs)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning()
    logger.warn({ jobId }, 'hire.revokeJob: no session on record — job marked revoked, nothing to revoke on-chain')
    return toJob(updated ?? jobRow, null, null, null)
  }

  if (sessionRow.revokedAt) {
    // Idempotent — matches session-store.ts's revokeSession() contract.
    return toJob(jobRow, toSession(sessionRow), null, null)
  }

  // Throws SessionNotLiveError if the session's key material isn't resident
  // in this process — an honest refusal, not a faked revoke (see file banner).
  const result = await altanaRevokeSession(sessionRow.id)
  if (!result) {
    throw new SessionNotLiveError(sessionRow.id)
  }

  const [updatedSession] = await db
    .update(sessions)
    .set({ revokedAt: new Date(result.revokedAt) })
    .where(eq(sessions.id, sessionRow.id))
    .returning()
  const [updatedJob] = await db
    .update(jobs)
    .set({ status: 'revoked', updatedAt: new Date(), completedAt: new Date() })
    .where(eq(jobs.id, jobId))
    .returning()

  logger.info({ jobId, sessionId: sessionRow.id, tx: result.tx }, 'hire.revokeJob: real Altana session revoked on-chain')

  return toJob(updatedJob ?? jobRow, updatedSession ? toSession(updatedSession) : null, null, null)
}

export interface JobEvent {
  type: 'created' | 'funded' | 'decision_registered' | 'outcome_attested' | 'revoked'
  jobId: string
  at: string
  payload: Record<string, unknown>
}

/**
 * Backs the SSE stream at GET /v1/jobs/:id/events. Reads real rows: the
 * job's own lifecycle (created/funded/revoked, from the `jobs` row itself)
 * plus real `proof_records` rows for the job's agentId (the generic
 * `events` table has no jobId column — see ERD.md §2 — so proof_records is
 * the genuinely real, simpler source here, exactly as the task brief
 * allows). Emits what exists today, then closes — no fabricated future
 * ticks (unlike the old stub, which silently never emitted at all).
 */
export async function* streamJobEvents(jobId: string): AsyncGenerator<JobEvent> {
  const db = getDb()
  if (!db) return

  const jobRow = await getJobRow(db, jobId)
  if (!jobRow) return

  yield {
    type: 'created',
    jobId,
    at: jobRow.createdAt.toISOString(),
    payload: { status: jobRow.status, agentId: jobRow.agentId },
  }

  if (jobRow.status === 'funded' || jobRow.escrowRef) {
    yield {
      type: 'funded',
      jobId,
      at: jobRow.updatedAt.toISOString(),
      payload: { escrowRef: jobRow.escrowRef },
    }
  }

  const records = await db
    .select()
    .from(proofRecords)
    .where(eq(proofRecords.agentId, jobRow.agentId))
    .orderBy(asc(proofRecords.id))

  for (const record of records) {
    if (record.kind === 'decision') {
      yield {
        type: 'decision_registered',
        jobId,
        at: record.deadline ? record.deadline.toISOString() : new Date().toISOString(),
        payload: {
          recordId: record.id,
          intentHash: record.intentHash,
          registeredTx: record.registeredTx,
          registeredBlock: record.registeredBlock,
        },
      }
    } else {
      yield {
        type: 'outcome_attested',
        jobId,
        at: new Date().toISOString(),
        payload: {
          recordId: record.id,
          outcomeStatus: record.outcomeStatus,
          pnlUsd1: record.pnlUsd1 === null ? null : Number(record.pnlUsd1),
          attestedTx: record.attestedTx,
          attestedBlock: record.attestedBlock,
        },
      }
    }
  }

  if (jobRow.status === 'revoked') {
    yield {
      type: 'revoked',
      jobId,
      at: jobRow.updatedAt.toISOString(),
      payload: {},
    }
  }
}
