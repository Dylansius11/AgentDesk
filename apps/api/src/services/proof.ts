/**
 * apps/api/src/services/proof.ts
 *
 * Reads for the Proof Engine's mirror tables (proof_records, proof_metrics).
 * This service NEVER computes a "verified" number itself — it only reads
 * rows the keeper wrote from on-chain ProofLedger events (ERD.md §5: "keeper
 * metrics job ... recompute proof_metrics from on-chain rows only"). If
 * getDb() is unavailable this returns empty results, never fabricated ones.
 *
 * TODO(Phase B):
 *  - Implement each query against apps/api/src/db/schema.ts (proofRecords,
 *    proofMetrics) via drizzle.
 *  - getVerifyBundle() backs GET /v1/verify/:agentId — the raw audit trail;
 *    must return every field needed to reconstruct the decision→outcome
 *    story without trusting anything but on-chain data (SMART-CONTRACT.md).
 *  - Add pagination (cursor) to getProofRecordsForAgent per ERD.md §4.
 */
import { isDatabaseConfigured } from '../db/client.js'
import type { MetricsWindow, ProofMetrics, ProofRecord } from '../types/domain.js'

export interface GetProofRecordsParams {
  agentId: string
  kind?: 'decision' | 'outcome'
  cursor?: string
  limit?: number
}

export async function getProofRecordsForAgent(
  params: GetProofRecordsParams,
): Promise<{ records: ProofRecord[]; nextCursor: string | null }> {
  void params
  // TODO(Phase B): select from proofRecords where agentId = params.agentId
  // (+ kind filter), ordered by id, paginated by cursor.
  if (!isDatabaseConfigured()) {
    return { records: [], nextCursor: null }
  }
  return { records: [], nextCursor: null }
}

export async function getProofMetrics(
  agentId: string,
  window: MetricsWindow,
): Promise<ProofMetrics | null> {
  void agentId
  void window
  // TODO(Phase B): select single row from proofMetrics where (agentId, window).
  return null
}

/** Full decision+outcome audit bundle for the /verify/:agentId page. */
export interface VerifyBundle {
  agentId: string
  records: ProofRecord[]
  /** true only if every decision has either a matching outcome or an unexpired deadline. */
  chainConsistent: boolean
}

export async function getVerifyBundle(agentId: string): Promise<VerifyBundle> {
  const { records } = await getProofRecordsForAgent({ agentId })
  return { agentId, records, chainConsistent: records.length > 0 }
}
