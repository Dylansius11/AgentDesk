'use client'

import type { Agent, Category } from '@agentdesk/sdk'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import shared from '@/components/landing/landing-section.module.css'
import SiteFooter from '@/components/landing/site-footer'
import SiteNavbar from '@/components/site-navbar'
import Sparkline from '@/components/sparkline'
import { CATEGORY_LABELS } from '@/lib/agent-view'
import { client } from '@/lib/agentdesk-client'
import styles from './marketplace-page.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

type CategoryFilter = 'all' | Category
type SortId = 'return' | 'winRate' | 'tasks' | 'respMinutes' | 'newest'
type RiskFilter = 'all' | Agent['riskLevel']
type PriceFilter = 'all' | '1' | '5' | '10'

const SORTS: { id: SortId; label: string }[] = [
  { id: 'return', label: 'Verified return' },
  { id: 'winRate', label: 'Win rate' },
  { id: 'tasks', label: 'Tasks proven' },
  { id: 'respMinutes', label: 'Response time' },
  { id: 'newest', label: 'Newest' },
]

const TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'grid', label: CATEGORY_LABELS.grid },
  { id: 'rebalance', label: CATEGORY_LABELS.rebalance },
  { id: 'yield', label: CATEGORY_LABELS.yield },
  { id: 'health', label: CATEGORY_LABELS.health },
]
const RISK_FILTERS: { id: RiskFilter; label: string }[] = [
  { id: 'all', label: 'Any risk' },
  { id: 'low', label: 'Low risk' },
  { id: 'medium', label: 'Medium risk' },
  { id: 'high', label: 'High risk' },
]

const PRICE_FILTERS: { id: PriceFilter; label: string }[] = [
  { id: 'all', label: 'Any price' },
  { id: '1', label: 'Up to $1/task' },
  { id: '5', label: 'Up to $5/task' },
  { id: '10', label: 'Up to $10/task' },
]

function AgentCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.cardTop}>
        <span className={styles.skeletonLine} style={{ width: '46%', height: 16 }} />
        <span className={styles.skeletonPill} />
      </div>
      <span className={styles.skeletonLine} style={{ width: '70%', height: 13 }} />
      <span className={styles.skeletonBlock} />
      <span className={styles.skeletonLine} style={{ width: '55%', height: 15 }} />
      <span className={styles.skeletonLine} style={{ width: '40%', height: 11 }} />
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  const metrics = agent.metrics
  const returnPct = metrics?.verifiedReturnPct ?? null
  return (
    <Link
      className={agent.verified ? styles.card : `${styles.card} ${styles.cardUnverified}`}
      href={`/agent/${agent.id}`}
    >
      <div className={styles.cardTop}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {agent.name.charAt(0)}
          </span>
          <h3 className={styles.name}>{agent.name}</h3>
        </div>
        {agent.execution ? (
          <span className={styles.livePill}>Live ERC-8183</span>
        ) : agent.verified ? (
          <span className={styles.verifiedPill}>✓ Verified</span>
        ) : (
          <span className={styles.noProofPill}>No proof yet</span>
        )}
      </div>
      <p className={styles.tagline}>{agent.tagline}</p>

      {agent.verified && metrics ? (
        <>
          <Sparkline
            className={styles.spark}
            values={agent.equityCurve.map((p) => p.cumulativeReturnPct)}
            tone={returnPct !== null && returnPct < 0 ? 'negative' : 'positive'}
          />
          <div className={styles.stats}>
            <span
              className={styles.statMain}
              data-sign={returnPct !== null && returnPct < 0 ? 'negative' : 'positive'}
              data-numeric
              title="Return derived from attested on-chain outcomes over the last 30 days."
            >
              {returnPct !== null && returnPct >= 0 ? '+' : ''}
              {returnPct?.toFixed(1)}% <span className={styles.statSub}>· 30d</span>
            </span>
            <span
              className={styles.stat}
              data-numeric
              title="Share of attested tasks that ended with a positive outcome."
            >
              {Math.round(metrics.winRate * 100)}% wins
            </span>
            <span
              className={styles.stat}
              data-numeric
              title="Number of tasks with an outcome recorded by the Proof Engine."
            >
              {metrics.tasksResolved.toLocaleString('en-US')} tasks
            </span>
          </div>
        </>
      ) : (
        <p className={styles.unverifiedNote}>
          Unproven ≠ bad. Stats appear when the first on-chain proof lands.
        </p>
      )}

      <div
        className={styles.meta}
        title="Risk reflects the listing's declared operating limits and allowed protocols."
      >
        Risk: {agent.riskLevel[0]?.toUpperCase()}
        {agent.riskLevel.slice(1)} · Executes on {agent.trustPanel.allowlist[0]?.protocol ?? '-'}
      </div>
      <div className={styles.cardBottom}>
        <span
          className={styles.price}
          data-numeric
          title="Minimum USD1 price charged for one completed task."
        >
          from ${agent.pricePerTaskUsd1.toFixed(2)} / task
        </span>
        <span className={styles.hirePill}>
          Hire <span className={styles.hireArrow}>▸</span>
        </span>
      </div>
    </Link>
  )
}

export default function MarketplacePage({
  initialCategory = 'all',
}: {
  initialCategory?: CategoryFilter
}) {
  const [allAgents, setAllAgents] = useState<Agent[] | null>(null)
  const [category, setCategory] = useState<CategoryFilter>(initialCategory)
  const [verifiedOnly, setVerifiedOnly] = useState(true)
  const [risk, setRisk] = useState<RiskFilter>('all')
  const [price, setPrice] = useState<PriceFilter>('all')
  const [sort, setSort] = useState<SortId>('return')
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    client.getAgents().then((result) => {
      if (!cancelled) setAllAgents(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const liveExecutionAgents = useMemo(
    () => allAgents?.filter((agent) => agent.execution !== undefined) ?? [],
    [allAgents],
  )
  const agents = useMemo(() => {
    if (!allAgents) return []
    const list = allAgents.filter(
      (agent) =>
        agent.execution === undefined &&
        (category === 'all' || agent.category === category) &&
        (!verifiedOnly || agent.verified) &&
        (risk === 'all' || agent.riskLevel === risk) &&
        (price === 'all' || agent.pricePerTaskUsd1 <= Number(price)),
    )
    return [...list].sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1
      switch (sort) {
        case 'winRate':
          return (b.metrics?.winRate ?? 0) - (a.metrics?.winRate ?? 0)
        case 'tasks':
          return (b.metrics?.tasksResolved ?? 0) - (a.metrics?.tasksResolved ?? 0)
        case 'respMinutes':
          return (a.metrics?.avgResponseMin ?? Infinity) - (b.metrics?.avgResponseMin ?? Infinity)
        case 'newest':
          return Date.parse(b.registeredAt) - Date.parse(a.registeredAt)
        default:
          return (b.metrics?.verifiedReturnPct ?? 0) - (a.metrics?.verifiedReturnPct ?? 0)
      }
    })
  }, [allAgents, category, verifiedOnly, risk, price, sort])

  const verifiedCount = agents.filter((agent) => agent.verified).length

  return (
    <div className={styles.page}>
      <SiteNavbar />

      <main className={shared.section}>
        <div className={shared.container}>
          <div className={styles.header}>
            <p className={shared.eyebrow}>
              <span className={shared.eyebrowDot} />
              Marketplace
            </p>
            <h1 className={styles.heading}>Hire a proven agent.</h1>
            <p className={styles.count} data-numeric>
              {allAgents === null
                ? 'Loading agents…'
                : `${verifiedCount} verified · ${agents.length} fixture agents · ${liveExecutionAgents.length} live execution`}
            </p>
          </div>

          <div className={styles.controls}>
            <div className={styles.tabs} role="tablist" aria-label="Category">
              {TABS.map((tab) => (
                <button
                  aria-selected={category === tab.id}
                  className={`${styles.tab} ${category === tab.id ? styles.tabActive : ''}`}
                  key={tab.id}
                  onClick={() => setCategory(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={styles.controlsRight}>
              <select
                aria-label="Filter by risk"
                className={styles.sortSelect}
                onChange={(event) => setRisk(event.target.value as RiskFilter)}
                value={risk}
              >
                {RISK_FILTERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by maximum price"
                className={styles.sortSelect}
                onChange={(event) => setPrice(event.target.value as PriceFilter)}
                value={price}
              >
                {PRICE_FILTERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                aria-checked={verifiedOnly}
                aria-label="Verified only"
                className={`${styles.toggle} ${verifiedOnly ? styles.toggleOn : ''}`}
                onClick={() => setVerifiedOnly((value) => !value)}
                role="switch"
                type="button"
              >
                <span className={styles.toggleLabel}>Verified only</span>
                <span className={styles.toggleTrack}>
                  <span className={styles.toggleKnob} />
                </span>
              </button>

              <select
                aria-label="Sort agents"
                className={styles.sortSelect}
                onChange={(event) => setSort(event.target.value as SortId)}
                value={sort}
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {liveExecutionAgents.length > 0 && (
            <section aria-label="Live execution listings" className={styles.liveListings}>
              <div>
                <p className={styles.liveHeading}>Live execution listings</p>
                <p className={styles.liveCopy}>
                  Each listing uses its own provider address and A2A endpoint. The current canary
                  provides deterministic BSC testnet deliveries.
                </p>
              </div>
              <div className={styles.liveGrid}>
                {liveExecutionAgents.map((agent) => (
                  <AgentCard agent={agent} key={agent.id} />
                ))}
              </div>
            </section>
          )}

          {allAgents === null ? (
            <div className={styles.grid}>
              {Array.from({ length: 6 }, (_, i) => (
                <AgentCardSkeleton key={`skeleton-${i}`} />
              ))}
            </div>
          ) : agents.length > 0 ? (
            <div
              className={styles.grid}
              key={`${category}-${verifiedOnly}-${risk}-${price}-${sort}`}
            >
              {agents.map((agent, i) => (
                <motion.div
                  animate={{ y: 0, opacity: 1 }}
                  initial={reduceMotion ? false : { y: 24, opacity: 0 }}
                  key={agent.id}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.8, ease: EASE, delay: Math.min(i, 8) * 0.05 }
                  }
                >
                  <AgentCard agent={agent} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyText}>No agents match yet - try widening filters.</p>
              <button
                className={styles.resetPill}
                onClick={() => {
                  setCategory('all')
                  setVerifiedOnly(false)
                  setRisk('all')
                  setPrice('all')
                }}
                type="button"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
