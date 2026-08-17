/*
 * Per-agent profile detail derived deterministically from the mock agents —
 * equity curves, stat tiles, and proof-stream records. Pure functions so the
 * same agent always shows the same numbers until real fixtures land (A0.3).
 */

import { AGENTS, type Agent } from './mock-agents'

export type Timeframe = '7d' | '30d' | 'all'

export interface ProofRecord {
  id: number
  intent: string
  registeredAt: string
  executedAt: string
  outcome: number // signed USD1
  intentHash: string
  deadline: string
  block: number
}

function hashCode(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function hex(seed: string, length: number): string {
  const hash = hashCode(seed)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += (((hash >> (i % 8)) + i * 7) % 16).toString(16)
  }
  return out
}

export function erc8004Id(id: string): string {
  return `0x${hex(`${id}-a`, 3)}…${hex(`${id}-b`, 3)}`
}

/** cumulative verified P&L series (USD1), ending at the agent's 30d return */
export function equitySeries(agent: Agent, timeframe: Timeframe): number[] {
  const points = timeframe === '7d' ? 28 : timeframe === '30d' ? 60 : 120
  const seed = hashCode(agent.id)
  const final = ((agent.return30d ?? 1) / 100) * 200 // on a $200 demo stake
  const series: number[] = [0]
  for (let i = 1; i < points; i++) {
    const wobble = Math.sin((i + seed) * 0.7) * 0.18
    const trend = (final * i) / points
    const dip = Math.sin(i * 0.9 + seed) * final * 0.06
    series.push(Number((trend * (1 + wobble * 0.3) + dip * (i / points)).toFixed(3)))
  }
  series[points - 1] = Number(final.toFixed(3))
  return series
}

export interface StatTile {
  label: string
  value: string
  hint: string
}

export function statTiles(agent: Agent): StatTile[] {
  const drawdown = agent.risk === 'High' ? 9.2 : agent.risk === 'Medium' ? 6.2 : 3.4
  const categoryStat =
    agent.category === 'grid'
      ? {
          label: 'Grids completed',
          value: String(Math.round((agent.tasks ?? 0) / 5.6)),
        }
      : agent.category === 'rebalancing'
        ? {
            label: 'Ranges rebalanced',
            value: String(Math.round((agent.tasks ?? 0) / 3.1)),
          }
        : agent.category === 'yield'
          ? {
              label: 'Harvests collected',
              value: String(Math.round((agent.tasks ?? 0) / 4.2)),
            }
          : { label: 'Liquidations saved', value: String(agent.tasks ?? 0) }

  return [
    {
      label: 'Verified return (30d)',
      value: `+${agent.return30d?.toFixed(1)}%`,
      hint: 'Sum of every on-chain attested outcome over the last 30 days.',
    },
    {
      label: 'Win rate',
      value: `${agent.winRate}%`,
      hint: 'Share of attested tasks that ended positive.',
    },
    {
      label: 'Max drawdown',
      value: `−${drawdown.toFixed(1)}%`,
      hint: 'Worst peak-to-trough fall in the verified equity curve.',
    },
    {
      label: 'Tasks proven',
      value: (agent.tasks ?? 0).toLocaleString('en-US'),
      hint: 'Decisions pre-registered on-chain before execution.',
    },
    {
      label: 'Avg response',
      value: `${agent.respMinutes.toFixed(1)} min`,
      hint: 'Median time from pre-registered intent to execution.',
    },
    {
      label: categoryStat.label,
      value: categoryStat.value,
      hint: `Category metric computed only from on-chain records (${agent.protocol}).`,
    },
  ]
}

const INTENTS: Record<Agent['category'], string[]> = {
  grid: [
    'Buy 12 CAKE if price ≤ $2.10',
    'Sell 12 CAKE if price ≥ $2.30',
    'Widen grid band on volatility spike',
  ],
  rebalancing: [
    'Re-center LP range to 2.05–2.35',
    'Rebalance range after fee-tier shift',
    'Tighten band around moving average',
  ],
  yield: [
    'Move 50 USDT to farm at 12.4% APY',
    'Harvest rewards and re-stake',
    'Exit farm — APY fell below threshold',
  ],
  health: [
    'Repay 20 USD1 to keep health factor > 2.0',
    'Top up collateral on factor dip',
    'Rebalance debt across Venus and Aave',
  ],
}

function clock(base: number, offsetSeconds: number): string {
  const total = base + offsetSeconds
  const h = Math.floor(total / 3600) % 24
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/* ------------------------------------------------------------------ */
/* Leaderboard row — derived fields for the ranked table (Screen 6)   */
/* ------------------------------------------------------------------ */

export interface LeaderboardRow {
  agent: Agent
  return7d: number
  return30d: number
  returnAll: number
  maxDrawdown: number
  catStatValue: number
}

const CAT_STAT_DIVISOR: Record<Agent['category'], number> = {
  grid: 5.6,
  rebalancing: 3.1,
  yield: 4.2,
  health: 1,
}

export function leaderboardRows(): LeaderboardRow[] {
  return AGENTS.map((agent) => {
    const seed = hashCode(agent.id)
    const base = agent.return30d ?? 0
    return {
      agent,
      return7d: Number((base * 0.22).toFixed(1)),
      return30d: base,
      returnAll: Number((base * 1.8).toFixed(1)),
      maxDrawdown:
        agent.risk === 'High'
          ? Number((7 + (seed % 12)).toFixed(1))
          : agent.risk === 'Medium'
            ? Number((4 + (seed % 6)).toFixed(1))
            : Number((2 + (seed % 3)).toFixed(1)),
      catStatValue: Math.round((agent.tasks ?? 0) / CAT_STAT_DIVISOR[agent.category]),
    }
  })
}

export function proofRecords(agent: Agent, count = 6): ProofRecord[] {
  const seed = hashCode(agent.id)
  const intents = INTENTS[agent.category]
  const winRate = (agent.winRate ?? 80) / 100
  const startId = agent.tasks ?? 100

  return Array.from({ length: count }, (_, i) => {
    const win = (seed + i * 13) % 100 < winRate * 100
    const outcome = win
      ? Number((((seed + i) % 18) / 10 + 0.4).toFixed(2))
      : -Number((((seed + i) % 4) / 10 + 0.2).toFixed(2))
    const registered = 14 * 3600 + (seed % 1800) + i * 307
    return {
      id: startId - i,
      intent: intents[(seed + i) % intents.length],
      registeredAt: clock(registered, 0),
      executedAt: clock(registered, 36 + ((seed + i) % 90)),
      outcome,
      intentHash: `0x${hex(`${agent.id}-${i}`, 3)}…${hex(`${agent.id}-${i}-x`, 3)}`,
      deadline: clock(registered, 600),
      block: 52_301_884 - i * 731 - (seed % 400),
    }
  })
}
