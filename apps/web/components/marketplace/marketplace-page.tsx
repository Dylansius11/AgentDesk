'use client'

import type { Agent, Category } from '@agentdesk/sdk'
import { motion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import shared from '@/components/landing/landing-section.module.css'
import SiteFooter from '@/components/landing/site-footer'
import SiteNavbar from '@/components/site-navbar'
import Sparkline from '@/components/sparkline'
import { client } from '@/lib/agentdesk-client'
import { CATEGORY_LABELS } from '@/lib/agent-view'
import styles from './marketplace-page.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

type CategoryFilter = 'all' | Category
type SortId = 'return' | 'winRate' | 'tasks' | 'respMinutes' | 'newest'

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
        <h3 className={styles.name}>{agent.name}</h3>
        {agent.verified ? (
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
            >
              {returnPct !== null && returnPct >= 0 ? '+' : ''}
              {returnPct?.toFixed(1)}% <span className={styles.statSub}>· 30d</span>
            </span>
            <span className={styles.stat} data-numeric>
              {Math.round(metrics.winRate * 100)}% wins
            </span>
            <span className={styles.stat} data-numeric>
              {metrics.tasksResolved.toLocaleString('en-US')} tasks
            </span>
          </div>
        </>
      ) : (
        <p className={styles.unverifiedNote}>
          Unproven ≠ bad. Stats appear when the first on-chain proof lands.
        </p>
      )}

      <div className={styles.meta}>
        Risk: {agent.riskLevel[0]?.toUpperCase()}
        {agent.riskLevel.slice(1)} · Executes on {agent.trustPanel.allowlist[0]?.protocol ?? '—'}
      </div>
      <div className={styles.cardBottom}>
        <span className={styles.price} data-numeric>
          from ${agent.pricePerTaskUsd1.toFixed(2)} / task
        </span>
        <span className={styles.hirePill}>
          Hire <span className={styles.hireArrow}>▸</span>
        </span>
      </div>
    </Link>
  )
}

export default function MarketplacePage() {
  const [allAgents, setAllAgents] = useState<Agent[] | null>(null)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [verifiedOnly, setVerifiedOnly] = useState(true)
  const [sort, setSort] = useState<SortId>('return')

  useEffect(() => {
    let cancelled = false
    client.getAgents().then((result) => {
      if (!cancelled) setAllAgents(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const agents = useMemo(() => {
    if (!allAgents) return []
    const list = allAgents.filter(
      (agent) =>
        (category === 'all' || agent.category === category) && (!verifiedOnly || agent.verified),
    )
    return [...list].sort((a, b) => {
      // verified always rank above unverified
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
  }, [allAgents, category, verifiedOnly, sort])

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
              {allAgents === null ? 'Loading agents…' : `${verifiedCount} verified · ${agents.length} agents`}
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

          {allAgents === null ? (
            <div className={styles.grid}>
              {Array.from({ length: 6 }, (_, i) => (
                <AgentCardSkeleton key={`skeleton-${i}`} />
              ))}
            </div>
          ) : agents.length > 0 ? (
            <div className={styles.grid} key={`${category}-${verifiedOnly}-${sort}`}>
              {agents.map((agent, i) => (
                <motion.div
                  animate={{ y: 0, opacity: 1 }}
                  initial={{ y: 24, opacity: 0 }}
                  key={agent.id}
                  transition={{ duration: 0.8, ease: EASE, delay: Math.min(i, 8) * 0.05 }}
                >
                  <AgentCard agent={agent} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyText}>No agents match yet — try widening filters.</p>
              <button
                className={styles.resetPill}
                onClick={() => {
                  setCategory('all')
                  setVerifiedOnly(false)
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
