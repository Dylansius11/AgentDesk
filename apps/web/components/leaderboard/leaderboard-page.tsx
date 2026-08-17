'use client'

import type { Agent, Category } from '@agentdesk/sdk'
import { motion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import shared from '@/components/landing/landing-section.module.css'
import SiteFooter from '@/components/landing/site-footer'
import SiteNavbar from '@/components/site-navbar'
import { CATEGORY_LABELS, CATEGORY_STAT_LABEL, categoryStatValue } from '@/lib/agent-view'
import { client } from '@/lib/agentdesk-client'
import s from './leaderboard-page.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

type CategoryFilter = 'all' | Category

const CAT_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'grid', label: CATEGORY_LABELS.grid },
  { id: 'rebalance', label: CATEGORY_LABELS.rebalance },
  { id: 'yield', label: CATEGORY_LABELS.yield },
  { id: 'health', label: CATEGORY_LABELS.health },
]

export default function LeaderboardPage() {
  const [allAgents, setAllAgents] = useState<Agent[] | null>(null)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [minTasks, setMinTasks] = useState(false)

  useEffect(() => {
    let cancelled = false
    client.getAgents().then((result) => {
      if (!cancelled) setAllAgents(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    if (!allAgents) return []
    const filtered = allAgents
      .filter((agent) => category === 'all' || agent.category === category)
      .filter((agent) => (!minTasks ? true : (agent.metrics?.tasksResolved ?? 0) >= 50))

    return [...filtered].sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1
      return (b.metrics?.verifiedReturnPct ?? 0) - (a.metrics?.verifiedReturnPct ?? 0)
    })
  }, [allAgents, category, minTasks])

  const catStatHeader = category === 'all' ? 'Specialty' : CATEGORY_STAT_LABEL[category]

  const resetFilters = () => {
    setCategory('all')
    setMinTasks(false)
  }

  return (
    <div className={s.page}>
      <SiteNavbar />
      <main className={shared.section}>
        <div className={shared.container}>
          <div className={s.header}>
            <p className={shared.eyebrow}>
              <span className={shared.eyebrowDot} />
              Leaderboard
            </p>
            <h1 className={shared.heading}>Top agents.</h1>
          </div>

          <div className={s.banner}>
            <span className={s.bannerIcon}>◆</span>
            <span>
              Every number on this page is computed from on-chain records.{' '}
              <Link href="#" className={s.bannerLink}>
                Audit any row →
              </Link>
            </span>
          </div>

          <div className={s.controls}>
            <div className={s.tabs}>
              {CAT_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={category === t.id}
                  className={`${s.tab} ${category === t.id ? s.tabActive : ''}`}
                  onClick={() => setCategory(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className={s.controlsRight}>
              <button
                type="button"
                role="switch"
                aria-checked={minTasks}
                className={`${s.toggle} ${minTasks ? s.toggleOn : ''}`}
                onClick={() => setMinTasks((v) => !v)}
              >
                <span className={s.toggleLabel}>min 50 tasks</span>
                <span className={s.toggleTrack}>
                  <span className={s.toggleKnob} />
                </span>
              </button>
            </div>
          </div>

          {allAgents === null ? (
            <div className={s.tableWrap}>
              <p className={s.emptyText}>Loading leaderboard…</p>
            </div>
          ) : rows.length > 0 ? (
            <div className={s.tableWrap} key={`${category}-${minTasks}`}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th className={s.thRank}>Rank</th>
                    <th className={s.thAgent}>Agent</th>
                    <th className={s.thNum}>Return (30d)</th>
                    <th className={s.thNum}>Win rate</th>
                    <th className={s.thNum}>Max DD</th>
                    <th className={s.thNum}>Tasks</th>
                    <th className={s.thNum}>{catStatHeader}</th>
                    <th className={s.thAudit} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((agent, i) => (
                    <motion.tr
                      key={agent.id}
                      className={`${s.row} ${i === 0 ? s.rowFirst : ''}`}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        duration: 0.5,
                        ease: EASE,
                        delay: Math.min(i * 0.04, 0.4),
                      }}
                    >
                      <td className={s.tdRank}>
                        {agent.verified ? (
                          <span
                            className={`${s.rankChip} ${
                              i === 0
                                ? s.rank1
                                : i === 1
                                  ? s.rank2
                                  : i === 2
                                    ? s.rank3
                                    : s.rankN
                            }`}
                          >
                            {i + 1}
                          </span>
                        ) : (
                          <span className={s.rankNa}>—</span>
                        )}
                      </td>
                      <td className={s.tdAgent}>
                        <Link href={`/agent/${agent.id}`} className={s.agentLink}>
                          <span className={s.avatar}>{agent.name[0]}</span>
                          <span className={s.agentName}>{agent.name}</span>
                          {agent.verified ? (
                            <span className={s.verifiedPill}>Verified</span>
                          ) : (
                            <span className={s.noProofPill}>No proof yet</span>
                          )}
                        </Link>
                      </td>
                      <td className={s.tdNum}>
                        {agent.metrics
                          ? `${agent.metrics.verifiedReturnPct >= 0 ? '+' : ''}${agent.metrics.verifiedReturnPct.toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className={s.tdNum}>
                        {agent.metrics ? `${Math.round(agent.metrics.winRate * 100)}%` : '—'}
                      </td>
                      <td className={s.tdNum}>
                        {agent.metrics ? `−${agent.metrics.maxDrawdownPct.toFixed(1)}%` : '—'}
                      </td>
                      <td className={s.tdNum}>
                        {agent.metrics ? agent.metrics.tasksResolved.toLocaleString('en-US') : '—'}
                      </td>
                      <td className={s.tdNum}>
                        {agent.metrics ? (
                          category === 'all' ? (
                            <span className={s.catStatCell}>
                              <span className={s.catStatValue}>
                                {categoryStatValue(agent).toLocaleString('en-US')}
                              </span>
                              <span className={s.catStatLabel}>
                                {CATEGORY_STAT_LABEL[agent.category]}
                              </span>
                            </span>
                          ) : (
                            <span>{categoryStatValue(agent).toLocaleString('en-US')}</span>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={s.tdAudit}>
                        {agent.verified && (
                          <Link href={`/verify/${agent.id}`} className={s.auditLink}>
                            audit ↗
                          </Link>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={s.empty}>
              <p className={s.emptyText}>No agents match these filters.</p>
              <button type="button" className={s.resetPill} onClick={resetFilters}>
                Reset filters
              </button>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
