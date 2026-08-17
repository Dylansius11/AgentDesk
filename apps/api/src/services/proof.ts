/**
 * apps/api/src/services/proof.ts
 *
 * Reads for the Proof Engine's mirror tables (proof_records, proof_metrics).
 * This service NEVER computes a "verified" number itself — it only reads
 * rows the keeper wrote from on-chain ProofLedger events (ERD.md §5: "keeper
 * metrics job ... recompute proof_metrics from on-chain rows only"). If
 * getDb() is unavailable this returns empty results, never fabricated ones.
 *
 * WIRED THIS WAVE (2026-08-17, proof-engine-engineer): real drizzle queries
 * against the live proof_records / proof_metrics tables, replacing the
 * Phase-B stub. getProofMetrics() is a plain single-row SELECT — it does
 * NOT compute anything (the per-agent rolling-window derivation is the
 * keeper's recomputeMetricsForAgent(), still a documented no-op stub per
 * this task's explicit scope boundary; see apps/keeper/src/jobs/metrics.ts).
 *
 * proof_records PK note: `id` (on-chain record id) is not globally unique
 * alone — see apps/api/src/db/schema.ts's banner. Queries below therefore
 * order by (id, kind) rather than treating `id` as a row identity by itself.
 */
import { and, asc, eq, gt, or } from 'drizzle-orm'
import { getDb, isDatabaseConfigured } from '../db/client.js'
import { proofMetrics, proofRecords } from '../db/schema.js'
import type { MetricsWindow, ProofMetrics, ProofRecord } from '../types/domain.js'

export interface GetProofRecordsParams {
  agentId: string
  kind?: 'decision' | 'outcome'
  cursor?: string
  limit?: number
}

type ProofRecordRow = typeof proofRecords.$inferSelect

function toWire(row: ProofRecordRow): ProofRecord {
  return {
    id: row.id,
    agentId: row.agentId,
    kind: row.kind,
    intentHash: row.intentHash,
    deadline: row.deadline ? new Date(row.deadline).toISOString() : null,
    registeredTx: row.registeredTx,
    registeredBlock: row.registeredBlock,
    outcomeStatus: row.outcomeStatus,
    pnlUsd1: row.pnlUsd1 === null ? null : Number(row.pnlUsd1),
    evidenceUri: row.evidenceUri,
    attestedTx: row.attestedTx,
    attestedBlock: row.attestedBlock,
  }
}

/** Cursor = base64("<id>:<kind>") of the last row on the previous page — opaque to callers. */
function encodeCursor(row: ProofRecordRow): string {
  return Buffer.from(`${row.id}:${row.kind}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor: string): { id: number; kind: 'decision' | 'outcome' } | null {
  try {
    const [idStr, kind] = Buffer.from(cursor, 'base64url').toString('utf8').split(':')
    const id = Number(idStr)
    if (!Number.isFinite(id) || (kind !== 'decision' && kind !== 'outcome')) return null
    return { id, kind }
  } catch {
    return null
  }
}

const DEFAULT_LIMIT = 50

export async function getProofRecordsForAgent(
  params: GetProofRecordsParams,
): Promise<{ records: ProofRecord[]; nextCursor: string | null }> {
  if (!isDatabaseConfigured()) {
    return { records: [], nextCursor: null }
  }
  const db = getDb()
  if (!db) return { records: [], nextCursor: null }

  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), 200)
  const conditions = [eq(proofRecords.agentId, params.agentId)]
  if (params.kind) conditions.push(eq(proofRecords.kind, params.kind))

  const decodedCursor = params.cursor ? decodeCursor(params.cursor) : null
  if (decodedCursor) {
    // (id, kind) > (cursorId, cursorKind) in the same order as our ORDER BY.
    conditions.push(
      or(
        gt(proofRecords.id, decodedCursor.id),
        and(eq(proofRecords.id, decodedCursor.id), gt(proofRecords.kind, decodedCursor.kind)),
      ) as ReturnType<typeof gt>,
    )
  }

  const rows = await db
    .select()
    .from(proofRecords)
    .where(and(...conditions))
    .orderBy(asc(proofRecords.id), asc(proofRecords.kind))
    .limit(limit + 1)

  const page = rows.slice(0, limit)
  const hasMore = rows.length > limit
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1] as ProofRecordRow) : null

  return { records: page.map(toWire), nextCursor }
}

export async function getProofMetrics(
  agentId: string,
  window: MetricsWindow,
): Promise<ProofMetrics | null> {
  if (!isDatabaseConfigured()) return null
  const db = getDb()
  if (!db) return null

  const [row] = await db
    .select()
    .from(proofMetrics)
    .where(and(eq(proofMetrics.agentId, agentId), eq(proofMetrics.window, window)))
    .limit(1)

  if (!row) return null
  return {
    agentId: row.agentId,
    window: row.window,
    verifiedReturnPct: row.verifiedReturnPct === null ? 0 : Number(row.verifiedReturnPct),
    winRate: row.winRate === null ? 0 : Number(row.winRate),
    maxDrawdownPct: row.maxDrawdownPct === null ? 0 : Number(row.maxDrawdownPct),
    tasksResolved: row.tasksResolved ?? 0,
    avgResponseMin: row.avgResponseMin === null ? 0 : Number(row.avgResponseMin),
    categoryStat: (row.categoryStat as Record<string, number>) ?? {},
    computedAt: row.computedAt.toISOString(),
  }
}

/** Full decision+outcome audit bundle for the /verify/:agentId page. */
export interface VerifyBundle {
  agentId: string
  records: ProofRecord[]
  /** true only if every decision has either a matching outcome or an unexpired deadline. */
  chainConsistent: boolean
}

export async function getVerifyBundle(agentId: string): Promise<VerifyBundle> {
  // Verify page needs the FULL audit trail, not one paginated page — walk
  // cursors until exhausted rather than raising DEFAULT_LIMIT silently.
  const all: ProofRecord[] = []
  let cursor: string | null = null
  for (;;) {
    const { records, nextCursor }: { records: ProofRecord[]; nextCursor: string | null } =
      await getProofRecordsForAgent({ agentId, cursor: cursor ?? undefined, limit: 200 })
    all.push(...records)
    if (!nextCursor) break
    cursor = nextCursor
  }

  const now = Date.now()
  const decisions = all.filter((r) => r.kind === 'decision')
  const outcomeIds = new Set(all.filter((r) => r.kind === 'outcome').map((r) => r.id))
  const chainConsistent =
    all.length > 0 &&
    decisions.every(
      (d) => outcomeIds.has(d.id) || (d.deadline ? new Date(d.deadline).getTime() > now : false),
    )

  return { agentId, records: all, chainConsistent }
}
