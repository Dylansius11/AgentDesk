/**
 * apps/keeper/src/jobs/attester.ts
 *
 * The attestation loop — ARCHITECTURE.md §4.3, quoted here so the shape
 * below stays literally traceable to spec:
 *
 *   "Every N minutes: fetch unresolved decisions past deadline → for each,
 *    resolve outcome from objective sources (DEX pool price at deadline via
 *    Quoter/Pool state; Venus position state; escrow state) → submit
 *    attestation → append Postgres mirror → enqueue metrics recompute
 *    (per-agent rolling windows)."
 *
 * This is the ONLY place that should ever call ProofLedger.attestOutcome —
 * and it must only ever resolve outcomes from objective on-chain/pool state,
 * never from an agent's self-reported result (CLAUDE.md rule 3/4, ERD.md §1:
 * "Metrics computed only from on-chain rows"). KEEPER_ATTESTER_KEY is the
 * one privileged key this loop needs to sign attestOutcome txs — read only
 * from env (via lib/chain.ts), never logged (CLAUDE.md §4).
 *
 * WIRED THIS SESSION (Wave 4 local smoke test): fetchUnresolvedDecisions...()
 * reads lib/decision-store.ts's in-memory mirror (populated by the real
 * indexer job below it — see indexer.ts's header for why memory, not
 * Postgres, this session). resolveOutcomeFromObjectiveSources() makes a
 * REAL `getDecision` read against the deployed contract — never trusting the
 * indexer's cached copy for the value that actually gets attested — and
 * submitAttestation() makes a REAL signed `attestOutcome` transaction via
 * viem. Nothing here fabricates an outcome or a tx hash.
 *
 * Honest scope note on resolution: no PancakeSwap v3 pool / Venus deployment
 * exists on the local anvil instance this test runs against, so the
 * per-category Quoter/position-state algorithms described below stay
 * unbuilt (unchanged Phase B scope, SMART-CONTRACT.md §4) — resolving a
 * fabricated DEX price here would violate CLAUDE.md rule 4 far worse than
 * leaving it a TODO. What resolveOutcomeFromObjectiveSources() does instead,
 * for real: reads the decision straight off the deployed ProofLedger
 * contract (the one on-chain fact available in this environment) and
 * derives evidenceHash from that real intentHash/deadline — never from
 * anything the agent or the indexer claimed.
 *
 * TODO(Phase B):
 *  - fetchUnresolvedDecisionsPastDeadline(): once DATABASE_URL exists,
 *    prefer `SELECT ... FROM proof_records` over lib/decision-store.ts.
 *  - resolveOutcomeFromObjectiveSources(): branch on category —
 *      grid/rebalance/yield → PancakeSwap v3 Quoter/Pool state at deadline block
 *      health → Venus position state (health factor) at deadline block
 *    Never accept a number the agent itself reported.
 *  - On success: insert the outcome row into proof_records mirroring
 *    submitted.tx/block (currently only the in-memory store is updated).
 */
import { proofLedgerAbi } from '@agentdesk/sdk'
import { encodeAbiParameters, keccak256 } from 'viem'
import { keeperConfigured } from '../env.js'
import { getProofLedgerAddress, getPublicClient, getWalletClient } from '../lib/chain.js'
import { type IndexedDecision, listUnresolvedPastDeadline, markAttestedLocally } from '../lib/decision-store.js'
import { logger } from '../logger.js'
import { enqueueMetricsRecompute } from './metrics.js'

type ResolvedOutcome = {
  status: number // int8: 1 win | -1 loss | 0 neutral | 2 expired-unexecuted (viem maps int8 -> number)
  pnlUsd1: bigint // int128, USD1 (viem maps int128 -> bigint)
  evidenceHash: `0x${string}`
}

/** Mirrors proof_records.kind='decision' rows past their deadline with no outcome yet. */
async function fetchUnresolvedDecisionsPastDeadline(): Promise<IndexedDecision[]> {
  if (!keeperConfigured.chainRpc || !keeperConfigured.proofLedger) return []
  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  return listUnresolvedPastDeadline(nowSec)
}

/** Resolves an outcome from objective pool/protocol state ONLY — never from agent-reported data. */
async function resolveOutcomeFromObjectiveSources(decision: IndexedDecision): Promise<ResolvedOutcome | null> {
  if (!keeperConfigured.chainRpc) {
    logger.debug({ recordId: decision.recordId.toString() }, 'attester: chain RPC not configured — cannot resolve')
    return null
  }

  const publicClient = await getPublicClient()
  const address = getProofLedgerAddress()

  // Never trust the indexer's cached copy for the value we're about to
  // attest — re-read the decision straight from the contract. This IS the
  // "objective on-chain source" available in this local-anvil environment.
  const [, , intentHash, deadline, , resolved] = await publicClient.readContract({
    address,
    abi: proofLedgerAbi,
    functionName: 'getDecision',
    args: [decision.recordId],
  })

  if (resolved) {
    logger.debug({ recordId: decision.recordId.toString() }, 'attester: already resolved on-chain — skipping')
    markAttestedLocally(decision.recordId)
    return null
  }

  // See file header: no PancakeSwap/Venus deployment exists on this local
  // anvil instance, so the real per-category resolution algorithm
  // (SMART-CONTRACT.md §4) is not exercised by this smoke test. status is
  // deliberately neutral (0) with pnlUsd1=0 rather than a fabricated
  // win/loss number. evidenceHash IS derived from real on-chain data
  // (intentHash + deadline just read above), following the frozen
  // evidenceHash scheme (intentHash, executionTx, resolutionSource, prices)
  // — executionTx is the decision's own registration tx (the only real tx
  // this environment has), resolutionSource records why no DEX price exists.
  const evidenceHash = keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'string' }, { type: 'uint256' }],
      [
        intentHash,
        decision.txHash ?? `0x${'0'.repeat(64)}`,
        'local-anvil-smoke-test:no-dex-deployed',
        deadline,
      ],
    ),
  )

  return { status: 0, pnlUsd1: 0n, evidenceHash }
}

/** Submits ProofLedger.attestOutcome(recordId, status, pnlUsd1, evidenceHash). The ONLY attestation call site. */
async function submitAttestation(
  decision: IndexedDecision,
  outcome: ResolvedOutcome,
): Promise<{ tx: `0x${string}`; block: number } | null> {
  if (!keeperConfigured.attester || !keeperConfigured.proofLedger) {
    logger.debug(
      { recordId: decision.recordId.toString() },
      'attester: KEEPER_ATTESTER_KEY / ProofLedger address not configured — cannot submit',
    )
    return null
  }

  const publicClient = await getPublicClient()
  const walletClient = await getWalletClient()
  const address = getProofLedgerAddress()

  const hash = await walletClient.writeContract({
    address,
    abi: proofLedgerAbi,
    functionName: 'attestOutcome',
    args: [decision.recordId, outcome.status, outcome.pnlUsd1, outcome.evidenceHash],
    chain: walletClient.chain,
    account: walletClient.account ?? null,
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    logger.error({ recordId: decision.recordId.toString(), hash }, 'attester: attestOutcome transaction reverted')
    return null
  }

  return { tx: hash, block: Number(receipt.blockNumber) }
}

/** One tick of the attestation loop — see file header for the full ARCHITECTURE.md §4.3 shape. */
export async function runAttesterTick(): Promise<void> {
  const unresolved = await fetchUnresolvedDecisionsPastDeadline()
  if (unresolved.length === 0) {
    logger.debug('attester: no unresolved decisions past deadline')
    return
  }

  for (const decision of unresolved) {
    const outcome = await resolveOutcomeFromObjectiveSources(decision)
    if (!outcome) continue

    const submitted = await submitAttestation(decision, outcome)
    if (!submitted) continue

    markAttestedLocally(decision.recordId)
    logger.info(
      { recordId: decision.recordId.toString(), tx: submitted.tx, block: submitted.block },
      'attester: OutcomeAttested submitted',
    )

    // TODO(Phase B): insert outcome row into proof_records mirroring
    // submitted.tx/block, then:
    enqueueMetricsRecompute(decision.agentId.toString())
  }
}
