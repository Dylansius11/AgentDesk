/**
 * apps/keeper/src/db/schema.ts
 *
 * Literal structural mirror of the two tables the keeper writes to —
 * `agents` (FK anchor only) and `proof_records` — copied column-for-column
 * from `apps/api/src/db/schema.ts` (the ERD.md §2 source of truth).
 *
 * Why a copy instead of an import: ARCHITECTURE.md §3's import rule is
 * explicit — "apps/* may import from packages/sdk and packages/contracts
 * (types only). Apps never import each other." `packages/sdk` ("the seam
 * everything shares") currently only carries zod schemas + fixtures, no
 * drizzle table defs, so hoisting the shared schema there is the *correct*
 * long-term fix but is a separate, larger refactor than this task's scope
 * (it would also touch apps/api/src/services/session-store.ts and every
 * other schema consumer). Documented here instead of silently diverging:
 * if these two table shapes ever drift from apps/api/src/db/schema.ts,
 * that's a bug — keep them byte-for-byte identical until the sdk-hoist
 * happens. Proposed follow-up: move `agents`/`proofRecords` (and their
 * enums) into `packages/sdk/src/db/schema.ts`, re-export from both apps.
 *
 * proof_records PK note (2026-08-17): `id` (on-chain record id) is NOT
 * globally unique alone — a decision and its eventual outcome are two
 * separate INSERT-only rows sharing the same on-chain recordId (kind
 * discriminates them), because CLAUDE.md rule 1/7 forbid ever UPDATEing an
 * existing row. PK is therefore composite `(id, kind)`. See the matching
 * comment in apps/api/src/db/schema.ts for the full rationale and the
 * live-migration status (schema declares this; the actual Supabase table
 * has NOT been migrated to the composite PK yet this session — see this
 * task's final report for why (db:push blocked by the permission
 * classifier) — inserts here use onConflictDoNothing() so they degrade to a
 * harmless no-op against the old single-column PK rather than throwing).
 *
 * proof_metrics added (2026-08-17, proof-engine-engineer wave): jobs/metrics.ts
 * is the ONLY writer of this table (ERD.md §5) — recomputeMetricsForAgent()
 * upserts one row per (agentId, window). Unlike proof_records this table is
 * NOT append-only — it's an explicitly "recomputed by keeper; never hand-
 * edited" materialized view (ERD.md §2), so onConflictDoUpdate() here is
 * correct, not a violation of CLAUDE.md rule 1 (that rule protects the
 * on-chain mirror rows, not derived aggregates recomputed from them).
 */
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const proofRecordKindEnum = pgEnum('proof_record_kind', ['decision', 'outcome'])
export const outcomeStatusEnum = pgEnum('outcome_status', [
  'pending',
  'win',
  'loss',
  'neutral',
  'expired',
])
export const metricsWindowEnum = pgEnum('metrics_window', ['7d', '30d', 'all'])

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  ownerAddress: text('owner_address').notNull(),
  chainId: integer('chain_id').notNull(),
  registeredAt: timestamp('registered_at', { withTimezone: true }),
  uriMetadata: jsonb('uri_metadata'),
  capabilities: jsonb('capabilities'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  syncSource: text('sync_source'),
})

export const proofRecords = pgTable(
  'proof_records',
  {
    id: bigint('id', { mode: 'number' }).notNull(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    kind: proofRecordKindEnum('kind').notNull(),
    intentHash: text('intent_hash'),
    deadline: timestamp('deadline', { withTimezone: true }),
    registeredTx: text('registered_tx'),
    registeredBlock: bigint('registered_block', { mode: 'number' }),
    outcomeStatus: outcomeStatusEnum('outcome_status'),
    pnlUsd1: numeric('pnl_usd1', { precision: 14, scale: 2 }),
    evidenceUri: text('evidence_uri'),
    attestedTx: text('attested_tx'),
    attestedBlock: bigint('attested_block', { mode: 'number' }),
    raw: jsonb('raw'),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.kind] }),
    index('proof_records_agent_id_idx').on(table.agentId),
  ],
)

// proof_metrics — literal copy of apps/api/src/db/schema.ts's table (same
// rationale as the banner above: apps never import each other).
export const proofMetrics = pgTable(
  'proof_metrics',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    window: metricsWindowEnum('window').notNull(),
    verifiedReturnPct: numeric('verified_return_pct', { precision: 8, scale: 2 }),
    winRate: numeric('win_rate', { precision: 5, scale: 4 }),
    maxDrawdownPct: numeric('max_drawdown_pct', { precision: 8, scale: 2 }),
    tasksResolved: integer('tasks_resolved'),
    avgResponseMin: numeric('avg_response_min', { precision: 8, scale: 1 }),
    categoryStat: jsonb('category_stat'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.agentId, table.window] })],
)
