/**
 * apps/keeper/src/jobs/indexer.ts
 *
 * ProofLedger event indexer — ERD.md §5: "keeper indexer | ProofLedger
 * events (block poll) | insert proof_records". Watches for
 * DecisionRegistered / OutcomeAttested events and mirrors them into the
 * `proof_records` table so the API's reads never touch the chain directly
 * (ARCHITECTURE.md §1 boundary rule).
 *
 * NOT WIRED THIS SESSION — no BSC_RPC_URL / PROOFLEDGER_ADDRESS provisioned
 * (Wave 1B scope: worker skeleton, chain calls stubbed/no-op). Logs a clear
 * "skipped: not configured" line each tick instead of throwing or faking data.
 *
 * TODO(Phase B):
 *  - viem publicClient.getContractEvents against the ProofLedger address
 *    for both event types, from `lastIndexedBlock` to `latest`.
 *  - Insert new rows into proofRecords (apps/api/src/db/schema.ts) — this
 *    file should import that schema once packages/contracts publishes the
 *    ProofLedger ABI/address (currently being built in a parallel task).
 *  - Persist `lastIndexedBlock` (new column or a small `keeper_state` table
 *    — not yet in ERD.md; propose there when this gets wired).
 */
import { keeperConfigured } from '../env.js'
import { logger } from '../logger.js'

export async function runIndexerTick(): Promise<void> {
  if (!keeperConfigured.chainRpc || !keeperConfigured.proofLedger) {
    logger.debug(
      { chainRpc: keeperConfigured.chainRpc, proofLedger: keeperConfigured.proofLedger },
      'indexer: skipped — chain RPC / ProofLedger address not configured this session',
    )
    return
  }
  // TODO(Phase B): real event poll + proof_records insert.
  logger.debug('indexer: tick (no-op stub)')
}
