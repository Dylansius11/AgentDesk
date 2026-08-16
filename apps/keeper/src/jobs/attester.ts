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
 * never from an agent's self-reported result (CLAUDE.md rule 3, ERD.md §1:
 * "Metrics computed only from on-chain rows"). KEEPER_ATTESTER_KEY is the
 * one privileged key this loop needs to sign attestOutcome txs — read only
 * from env, never logged (CLAUDE.md §4).
 *
 * NOT WIRED THIS SESSION — every step below is a real function with the
 * right signature, but resolveOutcome()/submitAttestation() are no-ops that
 * log and return early when chain config is missing (which it always is
 * this session). Nothing here fabricates an outcome or a tx hash.
 *
 * TODO(Phase B):
 *  - fetchUnresolvedDecisionsPastDeadline(): query proof_records where
 *    kind='decision' and no matching outcome row and deadline < now().
 *  - resolveOutcomeFromObjectiveSources(): per category —
 *      grid/rebalance/yield → PancakeSwap v3 Quoter/Pool state at deadline block
 *      health → Venus position state (health factor) at deadline block
 *    Never accept a number the agent itself reported.
 *  - submitAttestation(): sign + send ProofLedger.attestOutcome(recordId,
 *    outcome, evidenceURI) using KEEPER_ATTESTER_KEY via viem walletClient.
 *  - On success: insert the outcome row into proof_records, then call
 *    jobs/metrics.ts's enqueueMetricsRecompute(agentId).
 */
import { keeperConfigured } from '../env.js'
import { logger } from '../logger.js'
import { enqueueMetricsRecompute } from './metrics.js'

/** Mirrors proof_records.kind='decision' rows past their deadline with no outcome yet. */
interface UnresolvedDecision {
  recordId: number
  agentId: string
  intentHash: string
  deadline: string
  category: 'grid' | 'rebalance' | 'yield' | 'health'
}

async function fetchUnresolvedDecisionsPastDeadline(): Promise<UnresolvedDecision[]> {
  if (!keeperConfigured.database) return []
  // TODO(Phase B): SELECT from proof_records d LEFT JOIN proof_records o
  // ON o.agent_id = d.agent_id AND o.kind='outcome' WHERE d.kind='decision'
  // AND o.id IS NULL AND d.deadline < now().
  return []
}

type ResolvedOutcome = {
  status: 'win' | 'loss' | 'neutral' | 'expired'
  pnlUsd1: number
  evidenceUri: string
}

/** Resolves an outcome from objective pool/protocol state ONLY — never from agent-reported data. */
async function resolveOutcomeFromObjectiveSources(
  decision: UnresolvedDecision,
): Promise<ResolvedOutcome | null> {
  if (!keeperConfigured.chainRpc) {
    logger.debug(
      { recordId: decision.recordId },
      'attester: chain RPC not configured — cannot resolve',
    )
    return null
  }
  // TODO(Phase B): branch on decision.category —
  //   grid/rebalance/yield -> PancakeSwap v3 Quoter/Pool state
  //   health                -> Venus position state (health factor)
  return null
}

/** Submits ProofLedger.attestOutcome(recordId, outcome, evidenceURI). The ONLY attestation call site. */
async function submitAttestation(
  decision: UnresolvedDecision,
  outcome: ResolvedOutcome,
): Promise<{ tx: string; block: number } | null> {
  if (!keeperConfigured.attester || !keeperConfigured.proofLedger) {
    logger.debug(
      { recordId: decision.recordId },
      'attester: KEEPER_ATTESTER_KEY / ProofLedger address not configured — cannot submit',
    )
    return null
  }
  // TODO(Phase B): viem walletClient.writeContract({ ...attestOutcome, account: attesterAccount })
  // using `outcome` (status/pnlUsd1/evidenceUri) as the call args.
  void outcome
  return null
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

    // TODO(Phase B): insert outcome row into proof_records mirroring
    // submitted.tx/block, then:
    enqueueMetricsRecompute(decision.agentId)
  }
}
