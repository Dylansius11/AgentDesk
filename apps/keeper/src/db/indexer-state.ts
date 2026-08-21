import { and, between, eq, or } from 'drizzle-orm'
import { type Database, getDb } from './client.js'
import {
  type DecisionRowInput,
  insertDecisionRowWithDb,
  insertOutcomeRowWithDb,
  type OutcomeRowInput,
} from './proof-records.js'
import { keeperState, proofRecords } from './schema.js'

export const PROOF_LEDGER_STREAM = 'proof-ledger-events'

export interface KeeperCheckpointIdentity {
  chainId: number
  contractAddress: string
  stream: string
}

export interface KeeperCheckpoint extends KeeperCheckpointIdentity {
  nextBlock: bigint
  lastProcessedBlockHash: string | null
}

export interface IndexedProofBatch {
  decisions: DecisionRowInput[]
  outcomes: OutcomeRowInput[]
}

interface TransactionRunner<Tx> {
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>
}

/**
 * The checkpoint callback is reached only after all proof writes succeed.
 * PostgreSQL rolls back both callbacks when either rejects.
 */
export async function commitInTransaction<Tx>(
  db: TransactionRunner<Tx>,
  writeProofs: (tx: Tx) => Promise<void>,
  advanceCheckpoint: (tx: Tx) => Promise<void>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await writeProofs(tx)
    await advanceCheckpoint(tx)
  })
}

function configuredDb(): Database {
  const db = getDb()
  if (!db) throw new Error('indexer: DATABASE_URL is required for durable checkpointing')
  return db
}

export async function getKeeperCheckpoint(
  identity: KeeperCheckpointIdentity,
): Promise<KeeperCheckpoint | undefined> {
  const db = configuredDb()
  const [checkpoint] = await db
    .select()
    .from(keeperState)
    .where(
      and(
        eq(keeperState.chainId, identity.chainId),
        eq(keeperState.contractAddress, identity.contractAddress),
        eq(keeperState.stream, identity.stream),
      ),
    )

  return checkpoint
}

/**
 * Inserts every event idempotently and advances the durable checkpoint only
 * after those writes succeed. This is the sole indexer checkpoint writer.
 */
export async function commitIndexedProofBatch(
  identity: KeeperCheckpointIdentity,
  batch: IndexedProofBatch,
  fromBlock: bigint,
  toBlock: bigint,
  nextBlock: bigint,
  lastProcessedBlockHash: string,
): Promise<ReconciliationEvidence> {
  const db = configuredDb()
  let evidence: ReconciliationEvidence | undefined
  await commitInTransaction(
    db,
    async (tx) => {
      for (const decision of batch.decisions) await insertDecisionRowWithDb(tx, decision)
      for (const outcome of batch.outcomes) await insertOutcomeRowWithDb(tx, outcome)
      evidence = await reconcileReplayBatchWithDb(tx, batch, fromBlock, toBlock)
      if (evidence.missingEventIds.length > 0 || evidence.unexpectedEventIds.length > 0) {
        throw new Error(
          `indexer: overlap reconciliation mismatch; missing=${evidence.missingEventIds.join(',') || 'none'} unexpected=${evidence.unexpectedEventIds.join(',') || 'none'}`,
        )
      }
    },
    async (tx) => {
      await tx
        .insert(keeperState)
        .values({
          ...identity,
          nextBlock,
          lastProcessedBlockHash,
        })
        .onConflictDoUpdate({
          target: [keeperState.chainId, keeperState.contractAddress, keeperState.stream],
          set: { nextBlock, lastProcessedBlockHash, updatedAt: new Date() },
        })
    },
  )
  if (!evidence) throw new Error('indexer: reconciliation did not run')
  return evidence
}

export interface ReconciliationEvidence {
  expectedCount: number
  persistedCount: number
  missingEventIds: string[]
  unexpectedEventIds: string[]
}
export function compareReplayedEventIds(
  expectedEventIds: Iterable<string>,
  persistedEventIds: Iterable<string>,
): ReconciliationEvidence {
  const expected = new Set(expectedEventIds)
  const persisted = new Set(persistedEventIds)
  return {
    expectedCount: expected.size,
    persistedCount: persisted.size,
    missingEventIds: [...expected].filter((eventId) => !persisted.has(eventId)),
    unexpectedEventIds: [...persisted].filter((eventId) => !expected.has(eventId)),
  }
}


type DbReader = Pick<Database, 'select'>

async function reconcileReplayBatchWithDb(
  db: DbReader,
  batch: IndexedProofBatch,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<ReconciliationEvidence> {
  const expected = new Set([
    ...batch.decisions.map((row) => `decision:${row.recordId}`),
    ...batch.outcomes.map((row) => `outcome:${row.recordId}`),
  ])
  const rows = await db
    .select({ id: proofRecords.id, kind: proofRecords.kind })
    .from(proofRecords)
    .where(
      or(
        and(
          eq(proofRecords.kind, 'decision'),
          between(proofRecords.registeredBlock, Number(fromBlock), Number(toBlock)),
        ),
        and(
          eq(proofRecords.kind, 'outcome'),
          between(proofRecords.attestedBlock, Number(fromBlock), Number(toBlock)),
        ),
      ),
    )

  return compareReplayedEventIds(expected, rows.map((row) => `${row.kind}:${row.id}`))
}

/**
 * Reports canonical-vs-persisted IDs for a replay range. It never mutates
 * append-only proof history.
 */
export async function reconcileReplayBatch(
  batch: IndexedProofBatch,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<ReconciliationEvidence> {
  return reconcileReplayBatchWithDb(configuredDb(), batch, fromBlock, toBlock)
}
