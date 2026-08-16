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
 * `getContractEvents` calls against a real ProofLedger deployment. What's
 * still a session-scoped shim: the destination is lib/decision-store.ts's
 * in-memory map, not a `proof_records` Postgres INSERT — DATABASE_URL isn't
 * provisioned this session. The moment it is (Phase B), this tick should
 * additionally (or instead) write proof_records rows; the shape of what to
 * write is unchanged from the original TODO below.
 *
 * TODO(Phase B):
 *  - Insert new rows into proofRecords (apps/api/src/db/schema.ts) for both
 *    event kinds, keyed by recordId — this file already imports the real
 *    ProofLedger ABI/address (via @agentdesk/sdk + env.ts) now that
 *    packages/contracts publishes them (see packages/sdk/src/abi/).
 *  - Persist `lastIndexedBlock` in Postgres (a `keeper_state` table — not
 *    yet in ERD.md; propose there when this gets wired) instead of the
 *    in-process module variable used below, so a keeper restart doesn't
 *    re-scan from PROOFLEDGER_DEPLOY_BLOCK every time.
 */
import { proofLedgerAbi } from '@agentdesk/sdk'
import { env, keeperConfigured } from '../env.js'
import { getPublicClient, getProofLedgerAddress } from '../lib/chain.js'
import { markAttestedFromEvent, upsertDecision } from '../lib/decision-store.js'
import { logger } from '../logger.js'

/** In-process only — see the Phase B TODO above for why this isn't durable yet. */
let lastIndexedBlock: bigint | null = null

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
  const toBlock = latestBlock

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
      'indexer: DecisionRegistered observed on-chain (mirrored in-memory — DATABASE_URL not configured this session)',
    )
  }

  for (const event of outcomeEvents) {
    const { recordId } = event.args
    if (recordId === undefined) {
      logger.warn({ event }, 'indexer: OutcomeAttested event missing recordId — skipping')
      continue
    }
    markAttestedFromEvent(recordId)
    logger.info({ recordId: recordId.toString() }, 'indexer: OutcomeAttested observed on-chain (mirrored in-memory)')
  }

  lastIndexedBlock = toBlock + 1n
}
