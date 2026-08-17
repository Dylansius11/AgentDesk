'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import shared from '@/components/landing/landing-section.module.css'
import SiteFooter from '@/components/landing/site-footer'
import SiteNavbar from '@/components/site-navbar'
import Sparkline from '@/components/sparkline'
import { AGENTS, type Agent, CATEGORY_LABELS, type Category } from '@/lib/mock-agents'
import styles from './marketplace-page.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

type CategoryFilter = 'all' | Category
type SortId = 'return' | 'winRate' | 'tasks' | 'respMinutes' | 'listedDaysAgo'

const SORTS: { id: SortId; label: string }[] = [
  { id: 'return', label: 'Verified return' },
  { id: 'winRate', label: 'Win rate' },
  { id: 'tasks', label: 'Tasks proven' },
  { id: 'respMinutes', label: 'Response time' },
  { id: 'listedDaysAgo', label: 'Newest' },
]

const TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'grid', label: CATEGORY_LABELS.grid },
  { id: 'rebalancing', label: CATEGORY_LABELS.rebalancing },
  { id: 'yield', label: CATEGORY_LABELS.yield },
  { id: 'health', label: CATEGORY_LABELS.health },
]

function AgentCard({ agent }: { agent: Agent }) {
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

      {agent.verified ? (
        <>
          <Sparkline className={styles.spark} values={agent.spark} />
          <div className={styles.stats}>
            <span className={styles.statMain}>
              +{agent.return30d?.toFixed(1)}% <span className={styles.statSub}>· 30d</span>
            </span>
            <span className={styles.stat}>{agent.winRate}% wins</span>
            <span className={styles.stat}>{agent.tasks?.toLocaleString('en-US')} tasks</span>
          </div>
        </>
      ) : (
        <p className={styles.unverifiedNote}>
          Unproven ≠ bad. Stats appear when the first on-chain proof lands.
        </p>
      )}

      <div className={styles.meta}>
        Risk: {agent.risk} · Executes on {agent.protocol}
      </div>
      <div className={styles.cardBottom}>
        <span className={styles.price}>from ${agent.pricePerTask.toFixed(2)} / task</span>
        <span className={styles.hirePill}>
          Hire <span className={styles.hireArrow}>▸</span>
        </span>
      </div>
    </Link>
  )
}

export default function MarketplacePage() {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [verifiedOnly, setVerifiedOnly] = useState(true)
  const [sort, setSort] = useState<SortId>('return')

  const agents = useMemo(() => {
    const list = AGENTS.filter(
      (agent) =>
        (category === 'all' || agent.category === category) && (!verifiedOnly || agent.verified),
    )
    return [...list].sort((a, b) => {
      // verified always rank above unverified
      if (a.verified !== b.verified) return a.verified ? -1 : 1
      switch (sort) {
        case 'winRate':
          return (b.winRate ?? 0) - (a.winRate ?? 0)
        case 'tasks':
          return (b.tasks ?? 0) - (a.tasks ?? 0)
        case 'respMinutes':
          return a.respMinutes - b.respMinutes
        case 'listedDaysAgo':
          return a.listedDaysAgo - b.listedDaysAgo
        default:
          return (b.return30d ?? 0) - (a.return30d ?? 0)
      }
    })
  }, [category, verifiedOnly, sort])

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
            <p className={styles.count}>
              {verifiedCount} verified · {agents.length} agents
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

          {agents.length > 0 ? (
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
