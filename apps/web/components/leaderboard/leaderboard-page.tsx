'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import SiteNavbar from '@/components/site-navbar'
import SiteFooter from '@/components/landing/site-footer'
import type { Category } from '@/lib/mock-agents'
import { leaderboardRows, type LeaderboardRow } from '@/lib/mock-agent-detail'
import shared from '@/components/landing/landing-section.module.css'
import s from './leaderboard-page.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

type CategoryFilter = 'all' | Category
type WindowId = '7d' | '30d' | 'all'

const CAT_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'grid', label: 'Grid' },
  { id: 'rebalancing', label: 'Rebalancing' },
  { id: 'yield', label: 'Yield' },
  { id: 'health', label: 'Health Guard' },
]

const WINDOWS: { id: WindowId; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'ALL' },
]

const CAT_STAT_HEADER: Record<CategoryFilter, string> = {
  all: 'Specialty',
  grid: 'Grids completed',
  rebalancing: 'Ranges rebalanced',
  yield: 'Harvests collected',
  health: 'Liquidations saved',
}

const CAT_STAT_LABEL: Record<Category, string> = {
  grid: 'Grids completed',
  rebalancing: 'Ranges rebalanced',
  yield: 'Harvests collected',
  health: 'Liquidations saved',
}

function returnByWindow(row: LeaderboardRow, w: WindowId): number {
  if (!row.agent.verified) return 0
  return w === '7d' ? row.return7d : w === '30d' ? row.return30d : row.returnAll
}

export default function LeaderboardPage() {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [windowId, setWindowId] = useState<WindowId>('30d')
  const [minTasks, setMinTasks] = useState(false)

  const allRows = useMemo(() => leaderboardRows(), [])

  const rows = useMemo(() => {
    const filtered = allRows
      .filter(
        (r) =>
          category === 'all' || r.agent.category === category,
      )
      .filter((r) => (!minTasks ? true : (r.agent.tasks ?? 0) >= 50))

    return [...filtered].sort((a, b) => {
      if (a.agent.verified !== b.agent.verified)
        return a.agent.verified ? -1 : 1
      return returnByWindow(b, windowId) - returnByWindow(a, windowId)
    })
  }, [allRows, category, windowId, minTasks])

  const catStatHeader =
    category === 'all' ? 'Specialty' : CAT_STAT_HEADER[category]

  const resetFilters = () => {
    setCategory('all')
    setWindowId('30d')
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
              <div className={s.windowPills}>
                {WINDOWS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`${s.tab} ${windowId === w.id ? s.tabActive : ''}`}
                    onClick={() => setWindowId(w.id)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
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

          {rows.length > 0 ? (
            <div className={s.tableWrap} key={`${category}-${windowId}-${minTasks}`}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th className={s.thRank}>Rank</th>
                    <th className={s.thAgent}>Agent</th>
                    <th className={s.thNum}>Return</th>
                    <th className={s.thNum}>Win rate</th>
                    <th className={s.thNum}>Max DD</th>
                    <th className={s.thNum}>Tasks</th>
                    <th className={s.thNum}>{catStatHeader}</th>
                    <th className={s.thAudit} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <motion.tr
                      key={row.agent.id}
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
                        {row.agent.verified ? (
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
                        <Link
                          href={`/agent/${row.agent.id}`}
                          className={s.agentLink}
                        >
                          <span className={s.avatar}>
                            {row.agent.name[0]}
                          </span>
                          <span className={s.agentName}>
                            {row.agent.name}
                          </span>
                          {row.agent.verified ? (
                            <span className={s.verifiedPill}>Verified</span>
                          ) : (
                            <span className={s.noProofPill}>No proof yet</span>
                          )}
                        </Link>
                      </td>
                      <td className={s.tdNum}>
                        {row.agent.verified
                          ? `+${returnByWindow(row, windowId).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className={s.tdNum}>
                        {row.agent.verified ? `${row.agent.winRate}%` : '—'}
                      </td>
                      <td className={s.tdNum}>
                        {row.agent.verified
                          ? `−${row.maxDrawdown.toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className={s.tdNum}>
                        {row.agent.verified
                          ? (row.agent.tasks ?? 0).toLocaleString('en-US')
                          : '—'}
                      </td>
                      <td className={s.tdNum}>
                        {row.agent.verified ? (
                          category === 'all' ? (
                            <span className={s.catStatCell}>
                              <span className={s.catStatValue}>
                                {row.catStatValue.toLocaleString('en-US')}
                              </span>
                              <span className={s.catStatLabel}>
                                {CAT_STAT_LABEL[row.agent.category]}
                              </span>
                            </span>
                          ) : (
                            <span>
                              {row.catStatValue.toLocaleString('en-US')}
                            </span>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={s.tdAudit}>
                        {row.agent.verified && (
                          <Link
                            href={`/verify/${row.agent.id}`}
                            className={s.auditLink}
                          >
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
              <p className={s.emptyText}>
                No agents match these filters.
              </p>
              <button
                type="button"
                className={s.resetPill}
                onClick={resetFilters}
              >
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
