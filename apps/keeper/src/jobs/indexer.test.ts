import assert from 'node:assert/strict'
import test from 'node:test'
import {
  type KeeperCheckpoint,
  commitInTransaction,
  compareReplayedEventIds,
} from '../db/indexer-state.js'
import {
  MAX_BLOCKS_PER_QUERY,
  assertCheckpointHash,
  calculateIndexerRange,
} from './indexer.js'

test('indexer range starts at bounded overlap and caps RPC queries at 50k blocks', () => {
  const range = calculateIndexerRange(60_000n, 1n, 120_000n, 128n)

  assert.ok(range)
  assert.deepEqual(range, {
    fromBlock: 59_872n,
    toBlock: 109_871n,
    nextBlock: 109_872n,
  })
  assert.equal(range.toBlock - range.fromBlock + 1n, MAX_BLOCKS_PER_QUERY)
})

test('failed proof write rolls back and never invokes the checkpoint write', async () => {
  let checkpoint = 10n
  let checkpointWrites = 0
  const db = {
    async transaction<T>(work: (tx: { insertProof(): Promise<void>; checkpoint(next: bigint): void }) => Promise<T>) {
      const original = checkpoint
      try {
        return await work({
          async insertProof() {
            throw new Error('proof insert failed')
          },
          checkpoint(next) {
            checkpointWrites += 1
            checkpoint = next
          },
        })
      } catch (error) {
        checkpoint = original
        throw error
      }
    },
  }

  await assert.rejects(
    commitInTransaction(
      db,
      async (tx) => tx.insertProof(),
      async (tx) => {
        tx.checkpoint(11n)
      },
    ),
    /proof insert failed/,
  )
  assert.equal(checkpoint, 10n)
  assert.equal(checkpointWrites, 0)
})

test('checkpoint hash mismatch signals a bounded overlap replay before advancement', () => {
  const checkpoint: KeeperCheckpoint = {
    chainId: 97,
    contractAddress: '0xabc',
    stream: 'proof-ledger-events',
    nextBlock: 101n,
    lastProcessedBlockHash: '0x1111',
  }

  assert.throws(() => assertCheckpointHash(checkpoint, '0x2222'), /checkpoint hash mismatch/)
  const replay = calculateIndexerRange(checkpoint.nextBlock, 1n, 150n, 16n)
  assert.equal(replay?.fromBlock, 85n)
  assert.equal(replay?.nextBlock, 151n)
})

test('reconciliation reports missing and unexpected overlap event IDs', () => {
  const evidence = compareReplayedEventIds(
    ['decision:1', 'outcome:1'],
    ['decision:1', 'decision:2'],
  )

  assert.deepEqual(evidence, {
    expectedCount: 2,
    persistedCount: 2,
    missingEventIds: ['outcome:1'],
    unexpectedEventIds: ['decision:2'],
  })
})
