/**
 * ProofLedger event indexer.
 *
 * A durable keeper_state checkpoint is the only progress authority. Every
 * range is committed atomically with its idempotent proof-record inserts; the
 * checkpoint's next_block is always the first block not yet committed.
 */
import { proofLedgerAbi } from '@agentdesk/sdk'
import type { PublicClient } from 'viem'
import {
  type IndexedProofBatch,
  type KeeperCheckpoint,
  PROOF_LEDGER_STREAM,
  commitIndexedProofBatch,
  getKeeperCheckpoint,
} from '../db/indexer-state.js'
import { env, keeperConfigured } from '../env.js'
import { getChainId, getProofLedgerAddress, getPublicClient } from '../lib/chain.js'
import { markAttestedFromEvent, upsertDecision } from '../lib/decision-store.js'
import { logger } from '../logger.js'

/** Public RPCs commonly cap eth_getLogs at 50,000 blocks per request. */
export const MAX_BLOCKS_PER_QUERY = 50_000n

export interface IndexerRange {
  fromBlock: bigint
  toBlock: bigint
  nextBlock: bigint
}

export function calculateIndexerRange(
  nextBlock: bigint,
  deploymentBlock: bigint,
  finalizedHead: bigint,
  replayOverlapBlocks: bigint,
): IndexerRange | null {
  if (finalizedHead < deploymentBlock) return null

  const fromBlock =
    nextBlock > deploymentBlock + replayOverlapBlocks
      ? nextBlock - replayOverlapBlocks
      : deploymentBlock
  if (fromBlock > finalizedHead) return null

  const toBlock =
    finalizedHead - fromBlock + 1n > MAX_BLOCKS_PER_QUERY
      ? fromBlock + MAX_BLOCKS_PER_QUERY - 1n
      : finalizedHead

  return { fromBlock, toBlock, nextBlock: toBlock + 1n > nextBlock ? toBlock + 1n : nextBlock }
}

export function assertCheckpointHash(checkpoint: KeeperCheckpoint, observedHash: string | undefined): void {
  if (!checkpoint.lastProcessedBlockHash) {
    throw new Error(
      `indexer: checkpoint ${checkpoint.stream} at ${checkpoint.nextBlock} has no prior block hash`,
    )
  }
  if (!observedHash || observedHash.toLowerCase() !== checkpoint.lastProcessedBlockHash.toLowerCase()) {
    throw new Error(
      `indexer: checkpoint hash mismatch at block ${checkpoint.nextBlock - 1n}; refusing to advance append-only history`,
    )
  }
}

function startingBlock(): bigint {
  if (!env.PROOFLEDGER_DEPLOY_BLOCK) return 0n
  try {
    return BigInt(env.PROOFLEDGER_DEPLOY_BLOCK)
  } catch {
    throw new Error('indexer: PROOFLEDGER_DEPLOY_BLOCK must be an integer')
  }
}

function isUnavailableHistoryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return [
    'archive',
    'historical state',
    'missing trie node',
    'pruned',
    'history is not available',
  ].some((fragment) => message.includes(fragment))
}

async function requiredBlockHash(publicClient: PublicClient, blockNumber: bigint): Promise<string> {
  try {
    const block = await publicClient.getBlock({ blockNumber })
    if (!block.hash) throw new Error(`indexer: block ${blockNumber} returned no hash`)
    return block.hash
  } catch (error) {
    if (isUnavailableHistoryError(error)) {
      throw new Error(
        `indexer: archive RPC could not read block ${blockNumber}; refusing to skip unavailable history`,
        { cause: error },
      )
    }
    throw error
  }
}

interface DecisionEvent {
  args: {
    recordId?: bigint
    agentId?: bigint
    intentHash?: `0x${string}`
    deadline?: bigint
    registeredAt?: bigint
  }
  transactionHash?: `0x${string}`
  blockNumber?: bigint
}

interface OutcomeEvent {
  args: {
    recordId?: bigint
    agentId?: bigint
    status?: number
    pnlUsd1?: bigint
    evidenceHash?: `0x${string}`
    attestedAt?: bigint
  }
  transactionHash?: `0x${string}`
  blockNumber?: bigint
}

function eventBatch(
  decisionEvents: readonly DecisionEvent[],
  outcomeEvents: readonly OutcomeEvent[],
  chainId: number,
): IndexedProofBatch {
  const decisions = decisionEvents.map((event) => {
    const { recordId, agentId, intentHash, deadline, registeredAt } = event.args
    if (
      recordId === undefined ||
      agentId === undefined ||
      intentHash === undefined ||
      deadline === undefined ||
      registeredAt === undefined
    ) {
      throw new Error('indexer: DecisionRegistered event missing required arguments')
    }
    return {
      recordId,
      agentId,
      intentHash,
      deadline: BigInt(deadline),
      registeredAt: BigInt(registeredAt),
      txHash: event.transactionHash ?? undefined,
      blockNumber: event.blockNumber ?? undefined,
      chainId,
    }
  })

  const outcomes = outcomeEvents.map((event) => {
    const { recordId, agentId, status, pnlUsd1, evidenceHash, attestedAt } = event.args
    if (
      recordId === undefined ||
      agentId === undefined ||
      status === undefined ||
      pnlUsd1 === undefined ||
      evidenceHash === undefined ||
      attestedAt === undefined
    ) {
      throw new Error('indexer: OutcomeAttested event missing required arguments')
    }
    return {
      recordId,
      agentId,
      status,
      pnlUsd1,
      evidenceHash,
      attestedAt: BigInt(attestedAt),
      txHash: event.transactionHash ?? undefined,
      blockNumber: event.blockNumber ?? undefined,
      chainId,
    }
  })

  return { decisions, outcomes }
}

function mirrorInMemory(batch: IndexedProofBatch): void {
  for (const decision of batch.decisions) {
    upsertDecision(decision)
    logger.info(
      {
        recordId: decision.recordId.toString(),
        agentId: decision.agentId.toString(),
        deadline: decision.deadline.toString(),
      },
      'indexer: DecisionRegistered committed and mirrored in-memory',
    )
  }
  for (const outcome of batch.outcomes) {
    markAttestedFromEvent(outcome.recordId)
    logger.info(
      { recordId: outcome.recordId.toString() },
      'indexer: OutcomeAttested committed and mirrored in-memory',
    )
  }
}

export async function runIndexerTick(): Promise<void> {
  if (!keeperConfigured.chainRpc || !keeperConfigured.proofLedger) {
    logger.debug(
      { chainRpc: keeperConfigured.chainRpc, proofLedger: keeperConfigured.proofLedger },
      'indexer: skipped — archive RPC / ProofLedger address not configured',
    )
    return
  }
  if (!keeperConfigured.database) {
    logger.error('indexer: skipped — DATABASE_URL is required for durable checkpointing')
    return
  }

  const publicClient = await getPublicClient()
  const address = getProofLedgerAddress()
  const chainId = await getChainId()
  const identity = {
    chainId,
    contractAddress: address.toLowerCase(),
    stream: PROOF_LEDGER_STREAM,
  }
  const deploymentBlock = startingBlock()
  const latestBlock = await publicClient.getBlockNumber()
  const finalityBlocks = BigInt(env.KEEPER_FINALITY_BLOCKS)
  if (latestBlock < finalityBlocks) {
    logger.debug({ latestBlock: latestBlock.toString() }, 'indexer: no finalized block yet')
    return
  }
  const finalizedHead = latestBlock - finalityBlocks
  const checkpoint = await getKeeperCheckpoint(identity)
  const nextBlock = checkpoint?.nextBlock ?? deploymentBlock

  if (checkpoint && checkpoint.nextBlock - 1n > finalizedHead) {
    logger.debug(
      { finalizedHead: finalizedHead.toString(), nextBlock: checkpoint.nextBlock.toString() },
      'indexer: checkpoint is newer than the configured finalized head',
    )
    return
  }
  if (checkpoint) {
    const observedHash = await requiredBlockHash(publicClient, checkpoint.nextBlock - 1n)
    try {
      assertCheckpointHash(checkpoint, observedHash)
    } catch (error) {
      logger.warn(
        {
          err: error instanceof Error ? error.message : error,
          nextBlock: checkpoint.nextBlock.toString(),
          replayOverlapBlocks: env.KEEPER_REPLAY_OVERLAP_BLOCKS,
        },
        'indexer: checkpoint hash changed; rewinding the bounded overlap before any checkpoint advance',
      )
    }
  }

  const range = calculateIndexerRange(
    nextBlock,
    deploymentBlock,
    finalizedHead,
    BigInt(env.KEEPER_REPLAY_OVERLAP_BLOCKS),
  )
  if (!range) {
    logger.debug(
      { finalizedHead: finalizedHead.toString(), nextBlock: nextBlock.toString() },
      'indexer: no finalized replay range',
    )
    return
  }

  const [decisionEvents, outcomeEvents] = await Promise.all([
    publicClient.getContractEvents({
      address,
      abi: proofLedgerAbi,
      eventName: 'DecisionRegistered',
      fromBlock: range.fromBlock,
      toBlock: range.toBlock,
    }),
    publicClient.getContractEvents({
      address,
      abi: proofLedgerAbi,
      eventName: 'OutcomeAttested',
      fromBlock: range.fromBlock,
      toBlock: range.toBlock,
    }),
  ])
  const batch = eventBatch(decisionEvents, outcomeEvents, chainId)
  const lastProcessedBlockHash = await requiredBlockHash(publicClient, range.toBlock)

  const evidence = await commitIndexedProofBatch(
    identity,
    batch,
    range.fromBlock,
    range.toBlock,
    range.nextBlock,
    lastProcessedBlockHash,
  )
  mirrorInMemory(batch)
  logger.info(
    { ...evidence, fromBlock: range.fromBlock.toString(), toBlock: range.toBlock.toString() },
    'indexer: replay reconciliation matched persisted proof rows',
  )

  if (range.nextBlock <= finalizedHead) await runIndexerTick()
}
