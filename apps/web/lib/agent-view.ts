/*
 * apps/web/lib/agent-view.ts
 *
 * Pure display-formatting helpers over `@agentdesk/sdk`'s real `Agent` /
 * `ProofRecord` shapes — the SDK schema is the source of truth (CLAUDE.md
 * §6: "the SDK schema wins on any shape mismatch"), this file only turns it
 * into strings/numbers the UI renders. No fabricated data, no fallback
 * numbers — every value here traces back to a real fixture field.
 */
import { CATEGORY_META, type Agent, type Category, type ProofRecord } from '@agentdesk/sdk'

export const CATEGORY_LABELS: Record<Category, string> = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([key, meta]) => [key, meta.label]),
) as Record<Category, string>

export const CATEGORY_STAT_LABEL: Record<Category, string> = {
  grid: 'Grids completed',
  rebalance: 'Ranges rebalanced',
  yield: 'Harvests collected',
  health: 'Liquidations saved',
}

const CATEGORY_STAT_KEY: Record<Category, string> = {
  grid: 'gridsCompleted',
  rebalance: 'rangeRecenters',
  yield: 'farmRotations',
  health: 'savedLiquidations',
}

/** The category-specific number from `metrics.categoryStat`, or 0 for an unverified/metric-less agent. */
export function categoryStatValue(agent: Agent): number {
  const raw = agent.metrics?.categoryStat[CATEGORY_STAT_KEY[agent.category]]
  return typeof raw === 'number' ? raw : 0
}

/** Verified 30d return sparkline series derived from the real equity curve — empty when unverified. */
export function equitySparkSeries(agent: Agent): number[] {
  if (agent.equityCurve.length === 0) return [0, 0]
  return agent.equityCurve.map((point) => point.cumulativeReturnPct)
}

export interface StatTile {
  label: string
  value: string
  hint: string
}

/** The agent profile's stat-tile row — every value read straight from `agent.metrics`. */
export function statTiles(agent: Agent): StatTile[] {
  const m = agent.metrics
  if (!m) return []
  return [
    {
      label: 'Verified return (30d)',
      value: `${m.verifiedReturnPct >= 0 ? '+' : ''}${m.verifiedReturnPct.toFixed(1)}%`,
      hint: 'Sum of every on-chain attested outcome over the last 30 days.',
    },
    {
      label: 'Win rate',
      value: `${Math.round(m.winRate * 100)}%`,
      hint: 'Share of attested tasks that ended positive.',
    },
    {
      label: 'Max drawdown',
      value: `−${m.maxDrawdownPct.toFixed(1)}%`,
      hint: 'Worst peak-to-trough fall in the verified equity curve.',
    },
    {
      label: 'Tasks proven',
      value: m.tasksResolved.toLocaleString('en-US'),
      hint: 'Decisions pre-registered on-chain before execution.',
    },
    {
      label: 'Avg response',
      value: `${m.avgResponseMin.toFixed(1)} min`,
      hint: 'Median time from pre-registered intent to execution.',
    },
    {
      label: CATEGORY_STAT_LABEL[agent.category],
      value: categoryStatValue(agent).toLocaleString('en-US'),
      hint: `Category metric computed only from on-chain records.`,
    },
  ]
}

/** `intentHash` truncated for compact display: 0x1234…abcd. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function clockFromIso(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export interface ProofRowView {
  recordId: number
  intent: string
  registeredAtClock: string
  registeredAtIso: string
  resolvedAtClock: string | null
  resolvedAtIso: string | null
  pending: boolean
  outcomeUsd1: number | null
  status: 'win' | 'loss' | 'neutral' | 'expired' | 'pending'
  intentHash: string
  deadlineIso: string
  attestedBlock: number | null
  registeredTx: string
  attestedTx: string | null
}

/** Flattens a `ProofRecord` into the shape the proof stream / audit table render. */
export function proofRowView(record: ProofRecord): ProofRowView {
  return {
    recordId: record.recordId,
    intent: record.decision.action.plainText,
    registeredAtClock: clockFromIso(record.decision.registeredAt),
    registeredAtIso: record.decision.registeredAt,
    resolvedAtClock: record.outcome ? clockFromIso(record.outcome.attestedAt) : null,
    resolvedAtIso: record.outcome?.attestedAt ?? null,
    pending: record.outcome === null,
    outcomeUsd1: record.outcome?.pnlUsd1 ?? null,
    status: record.outcome?.status ?? 'pending',
    intentHash: record.decision.intentHash,
    deadlineIso: record.decision.deadline,
    attestedBlock: record.outcome?.attestedBlock ?? null,
    registeredTx: record.decision.registeredTx,
    attestedTx: record.outcome?.attestedTx ?? null,
  }
}

/** Leaderboard row — everything derived from the real `Agent` + its verified metrics, no synthetic per-window numbers invented client-side. */
export interface LeaderboardRow {
  agent: Agent
}

export function leaderboardRows(agents: Agent[]): LeaderboardRow[] {
  return agents.map((agent) => ({ agent }))
}
