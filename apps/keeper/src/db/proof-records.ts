/**
 * apps/keeper/src/db/proof-records.ts
 *
 * The keeper's ONLY writer of `proof_records` (+ its `agents` FK anchor) —
 * ERD.md §5: "keeper indexer | ProofLedger events (block poll) | insert
 * proof_records" / "keeper attester | ... | insert outcome row". Both
 * jobs/indexer.ts (block-poll observation, any attester) and
 * jobs/attester.ts (immediately after its own successful submission) call
 * into this module so there is exactly one insert code path per row kind —
 * no duplicated SQL, no risk of the two jobs disagreeing on shape.
 *
 * Insert-only, always. Every insert here uses onConflictDoNothing() keyed to
 * nothing beyond "let Postgres tell us it already exists" — this makes the
 * calls idempotent (indexer re-scanning a block range it already processed,
 * or attester + indexer both observing the same OutcomeAttested tx) without
 * ever issuing an UPDATE (CLAUDE.md rule 1/7, forbidden even for our own
 * re-submits).
 */
import type { Address } from 'viem'
import { logger } from '../logger.js'
import { getDb, isDatabaseConfigured } from './client.js'
import { agents, proofRecords } from './schema.js'

/**
 * Whatever chain the keeper's RPC actually resolves to (lib/chain.ts's
 * getChainId(), via eth_chainId) — 97 Chapel / 56 mainnet in real deploys,
 * but not narrowed to that union so local anvil (31337) keeps working too.
 */
export type ChainId = number

export interface DecisionRowInput {
  recordId: bigint
  agentId: bigint
  intentHash: `0x${string}`
  deadline: bigint // unix seconds
  registeredAt: bigint // unix seconds
  txHash: `0x${string}` | undefined
  blockNumber: bigint | undefined
  chainId: ChainId
}

export interface OutcomeRowInput {
  recordId: bigint
  agentId: bigint
  status: number // int8: 1 win | -1 loss | 0 neutral | 2 expired-unexecuted
  pnlUsd1: bigint
  evidenceHash: `0x${string}`
  attestedAt: bigint // unix seconds
  txHash: `0x${string}` | undefined
  blockNumber: bigint | undefined
  chainId: ChainId
}

function mapOutcomeStatus(status: number): 'win' | 'loss' | 'neutral' | 'expired' | 'pending' {
  if (status === 1) return 'win'
  if (status === -1) return 'loss'
  if (status === 0) return 'neutral'
  if (status === 2) return 'expired'
  logger.warn({ status }, 'proof-records: unexpected on-chain outcome status — storing as pending')
  return 'pending'
}

/** JSON.stringify chokes on bigint — this replacer stringifies them for the `raw` audit column. */
function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)))
}

/**
 * Ensures a minimal `agents` row exists so the proof_records FK doesn't
 * reject the insert — same pattern as apps/api/src/services/session-store.ts's
 * createSession(). `syncSource: 'agentdesk-keeper-anchor'` flags this row as
 * a local FK anchor, distinct from a real 8004scan/registry sync, exactly
 * like session-store.ts's own 'agentdesk-demo-seed' marker.
 */
async function ensureAgentAnchor(
  agentId: bigint,
  ownerAddress: Address | undefined,
  chainId: ChainId,
) {
  const db = getDb()
  if (!db) return
  await db
    .insert(agents)
    .values({
      id: agentId.toString(),
      ownerAddress: ownerAddress ?? '0x0000000000000000000000000000000000000000',
      chainId,
      syncSource: 'agentdesk-keeper-anchor',
    })
    .onConflictDoNothing()
}

/** Called by jobs/indexer.ts for every real DecisionRegistered event it observes. */
export async function insertDecisionRow(input: DecisionRowInput): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  const db = getDb()
  if (!db) return false

  await ensureAgentAnchor(input.agentId, undefined, input.chainId)

  const inserted = await db
    .insert(proofRecords)
    .values({
      id: Number(input.recordId),
      agentId: input.agentId.toString(),
      kind: 'decision',
      intentHash: input.intentHash,
      deadline: new Date(Number(input.deadline) * 1000),
      registeredTx: input.txHash ?? null,
      registeredBlock: input.blockNumber !== undefined ? Number(input.blockNumber) : null,
      raw: jsonSafe({
        recordId: input.recordId,
        agentId: input.agentId,
        intentHash: input.intentHash,
        deadline: input.deadline,
        registeredAt: input.registeredAt,
        txHash: input.txHash,
        blockNumber: input.blockNumber,
      }),
    })
    .onConflictDoNothing()
    .returning({ id: proofRecords.id })

  const wrote = inserted.length > 0
  logger.info(
    { recordId: input.recordId.toString(), agentId: input.agentId.toString(), wrote },
    wrote
      ? 'proof-records: decision row inserted'
      : 'proof-records: decision row insert skipped (already present)',
  )
  return wrote
}

/**
 * Called by jobs/indexer.ts (any observed OutcomeAttested event) AND by
 * jobs/attester.ts (immediately after its own successful submission) — both
 * paths funnel through the same onConflictDoNothing() insert, so whichever
 * runs first wins and the second is a harmless no-op.
 *
 * KNOWN LIMITATION (2026-08-17, documented in this task's final report): the
 * live Supabase `proof_records` table has not yet been migrated to the
 * composite (id, kind) primary key that apps/api/src/db/schema.ts now
 * declares (pnpm --filter api db:push was blocked by the permission
 * classifier — a schema-mutating DDL operation against a live database,
 * correctly treated as something a human should approve, not this agent).
 * Until that migration runs, this insert's ON CONFLICT DO NOTHING will
 * silently no-op for any outcome row whose recordId already has a decision
 * row (the still-live single-column `id` PK collides) — the write is
 * attempted for real, correctly shaped, and will start landing the moment
 * the migration is applied, no code change required.
 */
export async function insertOutcomeRow(input: OutcomeRowInput): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  const db = getDb()
  if (!db) return false

  await ensureAgentAnchor(input.agentId, undefined, input.chainId)

  const inserted = await db
    .insert(proofRecords)
    .values({
      id: Number(input.recordId),
      agentId: input.agentId.toString(),
      kind: 'outcome',
      outcomeStatus: mapOutcomeStatus(input.status),
      pnlUsd1: input.pnlUsd1.toString(),
      evidenceUri: input.evidenceHash,
      attestedTx: input.txHash ?? null,
      attestedBlock: input.blockNumber !== undefined ? Number(input.blockNumber) : null,
      raw: jsonSafe({
        recordId: input.recordId,
        agentId: input.agentId,
        status: input.status,
        pnlUsd1: input.pnlUsd1,
        evidenceHash: input.evidenceHash,
        attestedAt: input.attestedAt,
        txHash: input.txHash,
        blockNumber: input.blockNumber,
      }),
    })
    .onConflictDoNothing()
    .returning({ id: proofRecords.id })

  const wrote = inserted.length > 0
  logger.info(
    { recordId: input.recordId.toString(), agentId: input.agentId.toString(), wrote },
    wrote
      ? 'proof-records: outcome row inserted'
      : 'proof-records: outcome row insert skipped (already present, or PK migration pending — see file banner)',
  )
  return wrote
}

/** Diagnostics only — used by the reconciliation report, never authoritative for app logic. */
export async function countProofRecords(): Promise<number | null> {
  if (!isDatabaseConfigured()) return null
  const db = getDb()
  if (!db) return null
  const rows = await db.select({ id: proofRecords.id }).from(proofRecords)
  return rows.length
}
