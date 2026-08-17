'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import shared from '@/components/landing/landing-section.module.css'
import SiteFooter from '@/components/landing/site-footer'
import SiteNavbar from '@/components/site-navbar'
import {
  equitySeries,
  erc8004Id,
  proofRecords,
  statTiles,
  type Timeframe,
} from '@/lib/mock-agent-detail'
import { type Agent, CATEGORY_LABELS } from '@/lib/mock-agents'
import styles from './agent-profile-page.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const TIMEFRAMES: Timeframe[] = ['7d', '30d', 'all']

function EquityChart({ agent }: { agent: Agent }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d')
  const series = useMemo(() => equitySeries(agent, timeframe), [agent, timeframe])

  const width = 640
  const height = 220
  const pad = 6
  const max = Math.max(...series)
  const min = Math.min(...series, 0)
  const range = max - min || 1
  const step = (width - pad * 2) / (series.length - 1)
  const points = series.map((value, i) => {
    const x = pad + i * step
    const y = pad + (1 - (value - min) / range) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = `M${points.join(' L')}`
  const area = `${line} L${width - pad},${height} L${pad},${height} Z`
  const gridlines = [0.25, 0.5, 0.75].map((fraction) => pad + fraction * (height - pad * 2))

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Verified P&L</h3>
          <p className={styles.chartSub}>
            cumulative, USD1 · ends at +${(series[series.length - 1] ?? 0).toFixed(2)}
          </p>
        </div>
        <div className={styles.timeframes}>
          {TIMEFRAMES.map((option) => (
            <button
              className={`${styles.timeframe} ${timeframe === option ? styles.timeframeActive : ''}`}
              key={option}
              onClick={() => setTimeframe(option)}
              type="button"
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <svg
        key={timeframe}
        aria-label="Cumulative verified P&L"
        className={styles.chart}
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        {gridlines.map((y) => (
          <line
            key={y}
            x1={pad}
            x2={width - pad}
            y1={y}
            y2={y}
            stroke="rgba(0, 0, 0, 0.07)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <motion.path
          d={area}
          fill="rgba(0, 0, 0, 0.05)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: EASE }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="#000000"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: EASE }}
        />
      </svg>

      <p className={styles.chartCaption}>Every point derives from an on-chain record. Audit →</p>
    </div>
  )
}

function ProofRow({
  record,
  open,
  onToggle,
}: {
  record: ReturnType<typeof proofRecords>[number]
  open: boolean
  onToggle: () => void
}) {
  const positive = record.outcome >= 0
  return (
    <div className={open ? `${styles.proofRow} ${styles.proofRowOpen}` : styles.proofRow}>
      <button className={styles.proofButton} onClick={onToggle} type="button">
        <span className={styles.proofId}>#{record.id}</span>
        <span className={styles.proofIntent}>{record.intent}</span>
        <span className={styles.proofTimes}>
          {record.registeredAt} <span className={styles.proofArrow}>→</span> {record.executedAt}
        </span>
        <span className={positive ? styles.outcomeWin : styles.outcomeLoss}>
          {positive ? '+' : '−'}${Math.abs(record.outcome).toFixed(2)} ✓
        </span>
        <span className={open ? styles.chevronOpen : styles.chevron}>⌄</span>
      </button>
      {open && (
        <motion.div
          animate={{ height: 'auto', opacity: 1 }}
          className={styles.proofDetail}
          initial={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <span>intentHash {record.intentHash}</span>
          <span>deadline {record.deadline}</span>
          <span>attested block {record.block.toLocaleString('en-US')}</span>
        </motion.div>
      )}
    </div>
  )
}

export default function AgentProfilePage({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const tiles = useMemo(() => statTiles(agent), [agent])
  const records = useMemo(() => proofRecords(agent), [agent])
  const agent8004 = erc8004Id(agent.id)

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(agent8004)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.page}>
      <SiteNavbar />

      <main className={shared.section}>
        <div className={shared.container}>
          <Link className={styles.back} href="/marketplace">
            ← Marketplace
          </Link>

          <header className={styles.header}>
            <div className={styles.avatar}>{agent.name.charAt(0)}</div>
            <div className={styles.headerBody}>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{agent.name}</h1>
                {agent.verified ? (
                  <span className={styles.verifiedPill}>✓ Verified</span>
                ) : (
                  <span className={styles.noProofPill}>No proof yet</span>
                )}
              </div>
              <p className={styles.tagline}>{agent.tagline}</p>
              <div className={styles.chips}>
                <span className={styles.chip}>{CATEGORY_LABELS[agent.category]}</span>
                <button className={styles.idChip} onClick={copyId} type="button">
                  ERC-8004 {agent8004} · {copied ? 'Copied' : 'Copy'}
                </button>
                <span className={styles.dev}>by @cryptoforge ✓</span>
              </div>
            </div>
          </header>

          <div className={styles.columns}>
            <div className={styles.main}>
              {agent.verified ? (
                <>
                  <EquityChart agent={agent} />

                  <div className={styles.statsGrid}>
                    {tiles.map((tile) => (
                      <div className={styles.statTile} key={tile.label} title={tile.hint}>
                        <span className={styles.statValue}>{tile.value}</span>
                        <span className={styles.statLabel}>{tile.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className={styles.streamCard}>
                    <h3 className={styles.chartTitle}>Proof stream</h3>
                    <p className={styles.chartSub}>
                      intent registered on-chain <em>before</em> execution — newest first
                    </p>
                    <div className={styles.stream}>
                      {records.map((record) => (
                        <ProofRow
                          key={record.id}
                          onToggle={() =>
                            setExpanded((current) => (current === record.id ? null : record.id))
                          }
                          open={expanded === record.id}
                          record={record}
                        />
                      ))}
                    </div>
                    <a className={styles.viewAll} href="/marketplace">
                      View all {agent.tasks?.toLocaleString('en-US')} proofs →
                    </a>
                  </div>
                </>
              ) : (
                <div className={styles.emptyTrack}>
                  <span className={styles.emptyDot} />
                  <p className={styles.emptyText}>
                    First proofs are landing soon — metrics appear when they do.
                  </p>
                  <Link className={styles.emptyLink} href="/marketplace">
                    Browse verified agents →
                  </Link>
                </div>
              )}
            </div>

            <aside className={styles.rail}>
              <div className={styles.railCard}>
                <p className={styles.railPrice}>
                  from ${agent.pricePerTask.toFixed(2)}
                  <span className={styles.railPer}> / completed task</span>
                </p>
                <ul className={styles.limits}>
                  <li>
                    <span className={shared.eyebrowDot} /> Max spend $50/day
                  </li>
                  <li>
                    <span className={shared.eyebrowDot} /> Access expires in 7 days
                  </li>
                  <li>
                    <span className={shared.eyebrowDot} /> One-tap stop, always
                  </li>
                </ul>
                <Link className={styles.hireButton} href={`/agent/${agent.id}/hire`}>
                  Hire — takes 60s <span className={styles.hireArrow}>▸</span>
                </Link>
                <p className={styles.trustRow}>
                  Escrowed · pay on completion only · 3% platform fee
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
