/**
 * apps/keeper/src/jobs/indexer.ts
 *
 * ProofLedger event indexer — ERD.md §5: "keeper indexer | ProofLedger
 * events (block poll) | insert proof_records". Watches for
 * DecisionRegistered / OutcomeAttested events and mirrors them so the rest
 * of the keeper (and eventually the API) never touches the chain directly
 * for reads that don't need to be live (ARCHITECTURE.md §1 boundary rule).
 *
 * WIRED THIS SESSION (Wave 4 local smoke test): real viem
 * `getContractEvents` calls against a real ProofLedger deployment.
 *
 * WIRED THIS WAVE (2026-08-17, proof-engine-engineer): every observed event
 * now ALSO writes a real row into Postgres `proof_records` via
 * db/proof-records.ts (insertDecisionRow / insertOutcomeRow), in addition to
 * — not instead of — the existing lib/decision-store.ts in-memory mirror.
 * Decision kept deliberately: jobs/attester.ts's
 * fetchUnresolvedDecisionsPastDeadline() reads decision-store.ts, not
 * Postgres, and changing that read path was out of this task's scope (the
 * task brief explicitly allows either choice as long as the attester's
 * unresolved-lookup keeps working) — Postgres writes are additive so both
 * consumers stay correct. Postgres failures are caught and logged, never
 * allowed to break the in-memory mirror the attester depends on.
 *
 * TODO(Phase B):
 *  - Persist `lastIndexedBlock` in Postgres (a `keeper_state` table — not
 *    yet in ERD.md; propose there when this gets wired) instead of the
 *    in-process module variable used below, so a keeper restart doesn't
 *    re-scan from PROOFLEDGER_DEPLOY_BLOCK every time.
 *  - Once decision-store.ts's role is reconsidered, fetchUnresolvedDecisions
 *    PastDeadline() could read `proof_records` directly instead (see that
 *    file's own header).
 */
import { proofLedgerAbi } from '@agentdesk/sdk'
import { insertDecisionRow, insertOutcomeRow } from '../db/proof-records.js'
import { env, keeperConfigured } from '../env.js'
import { getChainId, getProofLedgerAddress, getPublicClient } from '../lib/chain.js'
import { markAttestedFromEvent, upsertDecision } from '../lib/decision-store.js'
import { logger } from '../logger.js'

/** In-process only — see the Phase B TODO above for why this isn't durable yet. */
let lastIndexedBlock: bigint | null = null
/** Public RPCs commonly cap eth_getLogs at 50,000 blocks per request. */
const MAX_BLOCKS_PER_QUERY = 50_000n

function startingBlock(): bigint {
  if (!env.PROOFLEDGER_DEPLOY_BLOCK) return 0n
  try {
    return BigInt(env.PROOFLEDGER_DEPLOY_BLOCK)
  } catch {
    logger.warn(
      { PROOFLEDGER_DEPLOY_BLOCK: env.PROOFLEDGER_DEPLOY_BLOCK },
      'indexer: PROOFLEDGER_DEPLOY_BLOCK is not a valid integer — falling back to block 0',
    )
    return 0n
  }
}

export async function runIndexerTick(): Promise<void> {
  if (!keeperConfigured.chainRpc || !keeperConfigured.proofLedger) {
    logger.debug(
      { chainRpc: keeperConfigured.chainRpc, proofLedger: keeperConfigured.proofLedger },
      'indexer: skipped — chain RPC / ProofLedger address not configured this session',
    )
    return
  }

  const publicClient = await getPublicClient()
  const address = getProofLedgerAddress()

  if (lastIndexedBlock === null) {
    lastIndexedBlock = startingBlock()
  }

  const latestBlock = await publicClient.getBlockNumber()
  if (latestBlock < lastIndexedBlock) {
    logger.debug(
      { latestBlock: latestBlock.toString(), lastIndexedBlock: lastIndexedBlock.toString() },
      'indexer: latest block is behind lastIndexedBlock — skipping this tick',
    )
    return
  }

  const fromBlock = lastIndexedBlock
  const toBlock =
    latestBlock - fromBlock + 1n > MAX_BLOCKS_PER_QUERY
      ? fromBlock + MAX_BLOCKS_PER_QUERY - 1n
      : latestBlock

  const [decisionEvents, outcomeEvents] = await Promise.all([
    publicClient.getContractEvents({
      address,
      abi: proofLedgerAbi,
      eventName: 'DecisionRegistered',
      fromBlock,
      toBlock,
    }),
    publicClient.getContractEvents({
      address,
      abi: proofLedgerAbi,
      eventName: 'OutcomeAttested',
      fromBlock,
      toBlock,
    }),
  ])

  const chainId = keeperConfigured.database ? await getChainId() : 0

  for (const event of decisionEvents) {
    const { recordId, agentId, intentHash, deadline, registeredAt } = event.args
    if (
      recordId === undefined ||
      agentId === undefined ||
      intentHash === undefined ||
      deadline === undefined ||
      registeredAt === undefined
    ) {
      logger.warn({ event }, 'indexer: DecisionRegistered event missing expected args — skipping')
      continue
    }
    upsertDecision({
      recordId,
      agentId,
      intentHash,
      deadline: BigInt(deadline),
      registeredAt: BigInt(registeredAt),
      txHash: event.transactionHash ?? undefined,
    })
    logger.info(
      { recordId: recordId.toString(), agentId: agentId.toString(), deadline: deadline.toString() },
      'indexer: DecisionRegistered observed on-chain (mirrored in-memory)',
    )

    try {
      await insertDecisionRow({
        recordId,
        agentId,
        intentHash,
        deadline: BigInt(deadline),
        registeredAt: BigInt(registeredAt),
        txHash: event.transactionHash ?? undefined,
        blockNumber: event.blockNumber ?? undefined,
        chainId,
      })
    } catch (err) {
      logger.error(
        { recordId: recordId.toString(), err: err instanceof Error ? err.message : err },
        'indexer: proof_records decision insert failed — in-memory mirror still holds, continuing',
      )
    }
  }

  for (const event of outcomeEvents) {
    const { recordId, agentId, status, pnlUsd1, evidenceHash, attestedAt } = event.args
    if (recordId === undefined) {
      logger.warn({ event }, 'indexer: OutcomeAttested event missing recordId — skipping')
      continue
    }
    markAttestedFromEvent(recordId)
    logger.info(
      { recordId: recordId.toString() },
      'indexer: OutcomeAttested observed on-chain (mirrored in-memory)',
    )

    if (
      agentId === undefined ||
      status === undefined ||
      pnlUsd1 === undefined ||
      evidenceHash === undefined ||
      attestedAt === undefined
    ) {
      logger.warn(
        { event },
        'indexer: OutcomeAttested event missing args needed for proof_records — skipping Postgres write',
      )
      continue
    }

    try {
      await insertOutcomeRow({
        recordId,
        agentId,
        status,
        pnlUsd1,
        evidenceHash,
        attestedAt: BigInt(attestedAt),
        txHash: event.transactionHash ?? undefined,
        blockNumber: event.blockNumber ?? undefined,
        chainId,
      })
    } catch (err) {
      logger.error(
        { recordId: recordId.toString(), err: err instanceof Error ? err.message : err },
        'indexer: proof_records outcome insert failed — in-memory mirror still holds, continuing',
      )
    }
  }

  lastIndexedBlock = toBlock + 1n
  if (lastIndexedBlock <= latestBlock) {
    await runIndexerTick()
  }
}
