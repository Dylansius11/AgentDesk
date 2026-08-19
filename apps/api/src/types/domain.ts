/**
 * apps/api/src/types/domain.ts
 *
 * LOCAL, TEMPORARY mirror of the wire shapes described in
 * docs/technical/ERD.md §2 and the API surface table in §4.
 *
 * Why local instead of importing packages/sdk: at the time this file was
 * written, packages/sdk only exports primitives.ts + category.ts (Address,
 * Hex32, AgentId, IsoDatetime, Category) — no Agent/ProofRecord/HireSession
 * schemas yet (that's a separate, concurrently-running task). Route/service
 * signatures below are shaped so swapping these interfaces for
 * `import type { Agent } from "@agentdesk/sdk"` is a pure find-and-replace
 * once that package lands — do not let handler logic depend on anything
 * these types don't already express.
 *
 * TODO(Phase A/B handoff): once packages/sdk publishes Agent/ProofRecord/
 * HireSession/Job/Session zod schemas, delete this file's duplicated shapes
 * and import from the sdk instead. Keep field names identical to ERD.md so
 * the swap is mechanical.
 *
 * PARTIAL HANDOFF (2026-08-17, hire.ts real wiring): packages/sdk now
 * publishes `HireConfigSchema` (schemas/hire-session.ts) — `Job.config`
 * below imports that real type instead of duplicating its shape. The rest
 * of this file (Agent summary/detail, ProofRecord, etc.) is still local per
 * the note above; only the hire/job surface was reconciled this wave (task
 * scope).
 */
import type { HireConfig } from '@agentdesk/sdk'

export type Category = 'grid' | 'rebalance' | 'yield' | 'health'
export type RiskLevel = 'low' | 'medium' | 'high'
export type ListingStatus = 'active' | 'paused' | 'delisted'
export type OutcomeStatus = 'pending' | 'win' | 'loss' | 'neutral' | 'expired'
export type JobStatus =
  | 'created'
  | 'funded'
  | 'active'
  | 'awaiting_attestation'
  | 'completed'
  | 'revoked'
  | 'failed'
  | 'expired'
  // Added 2026-08-17 (hire.ts real wiring) — mirrors packages/sdk's
  // JobStatusSchema + db/schema.ts's jobStatusEnum, same commit. The honest
  // fundJob() outcome when the real hireErc8183Agent() call hits the
  // documented $U wall (INTEGRATION.md I4) — never 'funded' unless funding
  // actually happened.
  | 'pending_funding'
export type MetricsWindow = '7d' | '30d' | 'all'

/** agents ⨝ listings ⨝ proof_metrics — the shape GET /v1/agents returns per row. */
export interface AgentSummary {
  id: string
  ownerAddress: string
  chainId: number
  /** ERC-8004 metadata name — identity only, NOT a marketplace listing name (listings are empty until publish). */
  name: string | null
  /** ERC-8004 registration time, best-effort from 8004scan `created_at`. */
  registeredAt: string | null
  category: Category | null
  tagline: string | null
  riskLevel: RiskLevel | null
  status: ListingStatus | null
  /** true only if a proof_metrics row exists for this agent — never inferred from agent-reported data. */
  verified: boolean
  verifiedReturnPct: number | null
  winRate: number | null
  lastSyncedAt: string | null
}

/** GET /v1/agents/:id — full detail incl. Trust Panel source. */
export interface AgentDetail extends AgentSummary {
  description: string | null
  capabilities: string[]
  defaultCaps: {
    spendCapUsd1: number
    durationDays: number
    allowlist: string[]
  } | null
  pricePerTaskUsd1: number | null
}

/** proof_records mirror row — decision or outcome. */
export interface ProofRecord {
  id: number
  agentId: string
  kind: 'decision' | 'outcome'
  intentHash: string | null
  deadline: string | null
  registeredTx: string | null
  registeredBlock: number | null
  outcomeStatus: OutcomeStatus | null
  pnlUsd1: number | null
  evidenceUri: string | null
  attestedTx: string | null
  attestedBlock: number | null
}

/** proof_metrics row — derived, keeper-recomputed only. */
export interface ProofMetrics {
  agentId: string
  window: MetricsWindow
  verifiedReturnPct: number
  winRate: number
  maxDrawdownPct: number
  tasksResolved: number
  avgResponseMin: number
  categoryStat: Record<string, number>
  computedAt: string
}

/**
 * jobs mirror row (ERC-8183 escrow). `config` is the real `@agentdesk/sdk`
 * `HireConfig` shape (updated 2026-08-17, hire.ts real wiring — see
 * ERD.md §3 same-commit note) — no more local ad hoc shape.
 */
export interface Job {
  id: string
  escrowRef: string | null
  agentId: string
  hirerAddress: string
  config: HireConfig
  status: JobStatus
  feeUsd1: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /**
   * The real Altana scoped session granted for this job (createJob), if
   * provisioning succeeded. Null when session provisioning failed
   * (`sessionError` explains why) — never fabricated.
   */
  session: Session | null
  /** Non-null only if real Altana wallet/session provisioning failed during createJob. */
  sessionError: string | null
  /** Non-null only after a fundJob() attempt failed (e.g. the documented $U wall, INTEGRATION.md I4) — never set alongside status='funded'. */
  fundingBlockedReason: string | null
}

/** sessions mirror row (Altana Keystore) — drives the Trust Panel sentence. */
export interface Session {
  id: string
  jobId: string
  agentId: string
  allowlist: string[]
  spendCapUsd1: number
  expiresAt: string
  revokedAt: string | null
  keystoreTx: string | null
}

/** GET /v1/leaderboard row. */
export interface LeaderboardEntry {
  agentId: string
  category: Category
  verifiedReturnPct: number
  winRate: number
  tasksResolved: number
  window: MetricsWindow
}

/** GET /v1/stats — landing counters. */
export interface LandingStats {
  totalAgents: number
  verifiedAgents: number
  totalDecisionsRegistered: number
  totalOutcomesAttested: number
}
