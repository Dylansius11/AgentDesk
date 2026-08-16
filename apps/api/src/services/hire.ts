/**
 * apps/api/src/services/hire.ts
 *
 * Job lifecycle (ERC-8183 escrow, mirrored to `jobs`/`receipts`) per
 * ARCHITECTURE.md §4.2 hire sequence and ERD.md §4 API surface. This service
 * never implements its own escrow — it orchestrates calls into
 * services/altana.ts (`hireErc8183Agent`) and mirrors resulting state.
 * CLAUDE.md rule 1: do not write custom escrow/identity/payments code here.
 *
 * NOT LIVE THIS SESSION — every function returns a stub job/receipt with an
 * obviously-fake id ("stub-job-1") rather than attempting any real escrow or
 * DB write, per Wave 1B scope (structure + stubs only).
 *
 * TODO(Phase B):
 *  - createJob(): insert into `jobs` (status=created), call
 *    altana.createScopedSession() for the session params, return combined result.
 *  - fundJob(): call altana.hireErc8183Agent() to fund escrow via x402/USD1,
 *    update jobs.status=funded, insert receipts row (status pending → settling).
 *  - revokeJob(): call altana.revokeSession() (1-tx Keystore revoke), update
 *    jobs.status=revoked + sessions.revoked_at.
 *  - streamJobEvents(): backs GET /v1/jobs/:id/events (SSE) — merge our
 *    `events` table with a chain-event subscription.
 */
import type { Job, JobStatus } from '../types/domain.js'

export interface CreateJobInput {
  agentId: string
  hirerAddress: string
  config: {
    amountUsd1: number
    spendCap: number
    durationDays: number
    allowlist: string[]
    triggers?: Record<string, unknown>
  }
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const now = new Date().toISOString()
  return {
    id: 'stub-job-1',
    escrowRef: null,
    agentId: input.agentId,
    hirerAddress: input.hirerAddress,
    config: { ...input.config, triggers: input.config.triggers ?? {} },
    status: 'created' satisfies JobStatus,
    feeUsd1: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

export async function fundJob(jobId: string): Promise<Job | null> {
  void jobId
  // TODO(Phase B): call services/altana.ts hireErc8183Agent(), then x402 settlement.
  return null
}

export async function revokeJob(jobId: string): Promise<Job | null> {
  void jobId
  // TODO(Phase B): call services/altana.ts revokeSession(), mirror jobs.status=revoked.
  return null
}

export interface JobEvent {
  type: 'created' | 'funded' | 'decision_registered' | 'outcome_attested' | 'revoked'
  jobId: string
  at: string
  payload: Record<string, unknown>
}

/** Backs the SSE stream at GET /v1/jobs/:id/events. Stub yields nothing (no live event source yet). */
export async function* streamJobEvents(jobId: string): AsyncGenerator<JobEvent> {
  // TODO(Phase B): merge `events` table rows with a live chain-event subscription.
  // The unreachable yield below keeps this a real generator (satisfies
  // lint/correctness/useYield) while emitting nothing at runtime.
  if (jobId.length < 0) {
    yield { type: 'created', jobId, at: new Date().toISOString(), payload: {} }
  }
}
