/**
 * apps/api/src/db/schema.ts
 *
 * Drizzle schema — the source of ERD.md truth per that doc's header:
 * "Postgres schema (drizzle — source: apps/api/src/db/schema.ts)".
 * Table/column shapes below are a direct, literal translation of
 * docs/technical/ERD.md §2. If you change a column here, update ERD.md in
 * the SAME commit (ERD doc contract) — do not let them drift.
 *
 * Boundary rule (ERD.md §1): on-chain data is truth, this is cache + derived
 * views. `proof_records` and `proof_metrics` in particular must never be
 * hand-edited outside the keeper (ERD.md §5 sync rules) — the app layer
 * treats them as insert/read-only from proof_records onward.
 *
 * Migrations: checked-in SQL migrations live in `apps/api/drizzle/`; apply
 * them only through the deployment-controlled migration path.
 */
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const categoryEnum = pgEnum('category', ['grid', 'rebalance', 'yield', 'health'])
export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high'])
export const listingStatusEnum = pgEnum('listing_status', ['active', 'paused', 'delisted'])
export const proofRecordKindEnum = pgEnum('proof_record_kind', ['decision', 'outcome'])
export const outcomeStatusEnum = pgEnum('outcome_status', [
  'pending',
  'win',
  'loss',
  'neutral',
  'expired',
])
export const metricsWindowEnum = pgEnum('metrics_window', ['7d', '30d', 'all'])
export const jobStatusEnum = pgEnum('job_status', [
  'created',
  'funded',
  'active',
  'awaiting_attestation',
  'completed',
  'revoked',
  'failed',
  'expired',
  // Added 2026-08-17 (hire.ts real wiring, see packages/sdk JobStatusSchema
  // + ERD.md jobs table note in same commit) — the honest fundJob() outcome
  // when the real hireErc8183Agent() call reaches the documented $U wall
  // (INTEGRATION.md I4). Never write 'funded' when funding did not happen.
  'pending_funding',
])

// ---------------------------------------------------------------------------
// agents — ERC-8004 mirror (from 8004scan / registry)
// ---------------------------------------------------------------------------

export const agents = pgTable('agents', {
  id: text('id').primaryKey(), // ERC-8004 agent id (on-chain identifier)
  ownerAddress: text('owner_address').notNull(),
  chainId: integer('chain_id').notNull(), // 56 | 97
  registeredAt: timestamp('registered_at', { withTimezone: true }),
  uriMetadata: jsonb('uri_metadata'), // raw registry URI payload (sanitized)
  capabilities: jsonb('capabilities'), // normalized capability tags (8004scan)
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  syncSource: text('sync_source'), // '8004scan' | 'registry'
})

// ---------------------------------------------------------------------------
// listings — our marketplace layer (1:1 optional → agents)
// ---------------------------------------------------------------------------

export const listings = pgTable('listings', {
  agentId: text('agent_id')
    .primaryKey()
    .references(() => agents.id),
  category: categoryEnum('category').notNull(),
  tagline: text('tagline'),
  description: text('description'),
  pricePerTaskUsd1: numeric('price_per_task_usd1', { precision: 12, scale: 2 }),
  riskLevel: riskLevelEnum('risk_level'),
  defaultCaps: jsonb('default_caps'), // { spend_cap_usd1, duration_days, allowlist[] }
  status: listingStatusEnum('status').notNull().default('active'),
  proofProgram: boolean('proof_program').notNull().default(false),
  claimedBy: text('claimed_by'), // developer address that signed the claim
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// developers
// ---------------------------------------------------------------------------

export const developers = pgTable('developers', {
  address: text('address').primaryKey(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  links: jsonb('links'),
  stakeAmount: numeric('stake_amount', { precision: 18, scale: 6 }), // P2 (staked listings)
})

// ---------------------------------------------------------------------------
// proof_records — ProofLedger mirror (append-only, like the chain)
// ---------------------------------------------------------------------------

// NOTE (2026-08-17, proof-engine-engineer wave): `id` alone cannot be the PK.
// Each on-chain recordId produces up to TWO rows here over its lifetime — a
// `kind='decision'` row at registration and a separate `kind='outcome'` row
// at attestation — because CLAUDE.md rule 1 / ERD.md §3 require proof_records
// to be strictly INSERT-only (no UPDATE/DELETE grants at the app layer): the
// outcome can never be written by mutating the decision row in place. Before
// this change `id` was declared `.primaryKey()` on its own, which made a
// second row for the same recordId (the outcome) a hard Postgres unique-
// violation — i.e. attestation could never actually be persisted. Verified
// against the live Supabase instance before this edit: `proof_records` had
// zero rows, so widening the PK to (id, kind) here and pushing it via
// `pnpm --filter api db:push` is a safe, additive schema correction, not a
// breaking migration over real data. ERD.md §2's `proof_records` PK note
// must be updated in the same commit as this file (doc contract, CLAUDE.md
// §4).
//
// STATUS (2026-08-17, applied): migration `drizzle/0001_fix_proof_records_
// composite_pk.sql` is live on the real Supabase instance — PM independently
// re-verified via information_schema (constraint `proof_records_id_kind_pk`
// on (id, kind)) and confirmed real outcome rows now write successfully
// (5 decision + 5 outcome rows present, chainConsistent:true via
// GET /v1/verify/:agentId). This code and the live DB now match.
export const proofRecords = pgTable(
  'proof_records',
  {
    id: bigint('id', { mode: 'number' }).notNull(), // on-chain record id (not globally unique alone — see note above)
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    kind: proofRecordKindEnum('kind').notNull(),
    intentHash: text('intent_hash'), // decision rows
    deadline: timestamp('deadline', { withTimezone: true }), // decision rows
    registeredTx: text('registered_tx'),
    registeredBlock: bigint('registered_block', { mode: 'number' }),
    outcomeStatus: outcomeStatusEnum('outcome_status'), // outcome rows
    pnlUsd1: numeric('pnl_usd1', { precision: 14, scale: 2 }),
    evidenceUri: text('evidence_uri'), // intent+execution+price bundle (IPFS/Greenfield P2)
    attestedTx: text('attested_tx'),
    attestedBlock: bigint('attested_block', { mode: 'number' }),
    raw: jsonb('raw'), // full event payload for audit page
  },
  (table) => [
    primaryKey({ columns: [table.id, table.kind] }),
    index('proof_records_agent_id_idx').on(table.agentId),
  ],
)

// ---------------------------------------------------------------------------
// keeper_state — durable ProofLedger indexer checkpoints
// ---------------------------------------------------------------------------

export const keeperState = pgTable(
  'keeper_state',
  {
    chainId: integer('chain_id').notNull(),
    contractAddress: text('contract_address').notNull(),
    stream: text('stream').notNull(),
    // The first block that has not been committed with its proof-record writes.
    nextBlock: bigint('next_block', { mode: 'bigint' }).notNull(),
    // Hash of next_block - 1; null only before the indexer has committed a block.
    lastProcessedBlockHash: text('last_processed_block_hash'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.contractAddress, table.stream] }),
  ],
)

// ---------------------------------------------------------------------------
// proof_metrics — derived per agent (recomputed by keeper; never hand-edited)
// ---------------------------------------------------------------------------

export const proofMetrics = pgTable(
  'proof_metrics',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    window: metricsWindowEnum('window').notNull(), // '7d' | '30d' | 'all'
    verifiedReturnPct: numeric('verified_return_pct', { precision: 8, scale: 2 }),
    winRate: numeric('win_rate', { precision: 5, scale: 4 }),
    maxDrawdownPct: numeric('max_drawdown_pct', { precision: 8, scale: 2 }),
    tasksResolved: integer('tasks_resolved'),
    avgResponseMin: numeric('avg_response_min', { precision: 8, scale: 1 }),
    categoryStat: jsonb('category_stat'), // e.g. { "saved_liquidations": 3 }
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.agentId, table.window] })],
)

// ---------------------------------------------------------------------------
// jobs — ERC-8183 escrow mirror
// ---------------------------------------------------------------------------

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  escrowRef: text('escrow_ref'), // ERC-8183 job identifier on-chain
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id),
  hirerAddress: text('hirer_address').notNull(),
  // Real @agentdesk/sdk HireConfig object, verbatim (amountUsd1, spendCapUsd1,
  // spendCapWindow, durationDays, allowlist: AllowlistEntry[]) — see
  // packages/sdk/src/schemas/hire-session.ts. Updated 2026-08-17 (hire.ts
  // real wiring) from the earlier ad hoc { amount_usd1, spend_cap, duration,
  // allowlist, triggers } shape this comment described before HireConfig existed.
  config: jsonb('config'),
  status: jobStatusEnum('status').notNull().default('created'),
  feeUsd1: numeric('fee_usd1', { precision: 12, scale: 2 }), // 3% protocol fee
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

// ---------------------------------------------------------------------------
// sessions — Altana Keystore mirror
// ---------------------------------------------------------------------------

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // session key / keystore entry id
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id),
  allowlist: jsonb('allowlist'), // human labels + raw entries (drives Trust Panel sentences)
  spendCapUsd1: numeric('spend_cap_usd1', { precision: 12, scale: 2 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  keystoreTx: text('keystore_tx'), // registration link
})

// ---------------------------------------------------------------------------
// receipts — x402 payment records
// ---------------------------------------------------------------------------

export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id),
  amountUsd1: numeric('amount_usd1', { precision: 12, scale: 2 }), // gross
  feeUsd1: numeric('fee_usd1', { precision: 12, scale: 2 }), // protocol fee
  settlementTx: text('settlement_tx'),
  payer: text('payer'),
  payee: text('payee'),
})

// ---------------------------------------------------------------------------
// users, watchlist, events, advantage_reports
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  address: text('address').primaryKey(), // wallet = identity
  prefs: jsonb('prefs'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const watchlist = pgTable(
  'watchlist',
  {
    userAddress: text('user_address')
      .notNull()
      .references(() => users.address),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userAddress, table.agentId] })],
)

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // page views, hire funnel steps, etc. (product analytics)
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const advantageReports = pgTable('advantage_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskLabel: text('task_label').notNull(), // TermiX deliverable: ≥3 real tasks with/without agent
  baseline: jsonb('baseline'),
  withAgent: jsonb('with_agent'),
  outputs: jsonb('outputs'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
