'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import shared from '@/components/landing/landing-section.module.css'
import SiteFooter from '@/components/landing/site-footer'
import SiteNavbar from '@/components/site-navbar'
import { erc8004Id, proofRecords, type ProofRecord } from '@/lib/mock-agent-detail'
import { type Agent, CATEGORY_LABELS } from '@/lib/mock-agents'
import styles from './verify.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function VerifyPage({ agent }: { agent: Agent }) {
  const [recomputing, setRecomputing] = useState(false)
  const [recomputedAgo, setRecomputedAgo] = useState('12s ago')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'win' | 'loss'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const records = useMemo(() => proofRecords(agent, 12), [agent])
  const agent8004 = erc8004Id(agent.id)

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        searchQuery === '' ||
        r.id.toString().includes(searchQuery) ||
        r.intent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.intentHash.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false
      if (filterTab === 'win') return r.outcome > 0
      if (filterTab === 'loss') return r.outcome <= 0
      return true
    })
  }, [records, searchQuery, filterTab])

  const triggerRecompute = () => {
    setRecomputing(true)
    setTimeout(() => {
      setRecomputing(false)
      setRecomputedAgo('just now')
      setToastMessage(
        `Verified: ${(agent.tasks ?? 1204).toLocaleString('en-US')} records scanned · 0 discrepancies found ✓`
      )
      setTimeout(() => setToastMessage(null), 4000)
    }, 1200)
  }

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedHash(label)
      setTimeout(() => setCopiedHash(null), 1500)
    } catch {
      setCopiedHash(null)
    }
  }

  return (
    <div className={styles.page}>
      <SiteNavbar />

      <main className={shared.section}>
        <div className={shared.container}>
          <Link className={styles.backLink} href={`/agent/${agent.id}`}>
            ← Back to {agent.name} Profile
          </Link>

          {/* Header */}
          <header className={styles.header}>
            <div className={styles.agentIdentity}>
              <div className={styles.avatar}>{agent.name.charAt(0)}</div>
              <div>
                <div className={styles.titleRow}>
                  <h1 className={styles.agentName}>Audit {agent.name}</h1>
                  {agent.verified ? (
                    <span className={styles.verifiedPill}>🛡 Verified Ledger</span>
                  ) : (
                    <span className={styles.noProofPill}>No Proof Yet</span>
                  )}
                </div>
                <p className={styles.tagline}>{agent.tagline}</p>
                <div className={styles.metaChips}>
                  <span className={styles.chip}>{CATEGORY_LABELS[agent.category]}</span>
                  <button
                    className={styles.idChip}
                    onClick={() => copyText(agent8004, '8004')}
                    type="button"
                  >
                    ERC-8004 {agent8004} · {copiedHash === '8004' ? 'Copied!' : 'Copy'}
                  </button>
                  <span className={styles.chip}>Executes on {agent.protocol}</span>
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              <div className={styles.liveChip}>
                <span className={styles.pulseDot} />
                Recomputed from chain · {recomputedAgo}
              </div>
              <Link className={styles.profileBtn} href={`/agent/${agent.id}`}>
                View Profile & Hire ▸
              </Link>
            </div>
          </header>

          {/* Differentiator Callout Banner */}
          <div className={styles.calloutBanner}>
            <div>
              <p className={styles.calloutText}>
                All metrics shown on AgentDesk for <strong className={styles.calloutHighlight}>{agent.name}</strong> derive from{' '}
                <strong className={styles.calloutHighlight}>{(agent.tasks ?? 1204).toLocaleString('en-US')} on-chain records</strong>.
                Decisions are pre-registered before execution and sealed after. Nothing else is used to calculate returns.
              </p>
            </div>
            <button
              className={styles.recomputeBtn}
              disabled={recomputing}
              onClick={triggerRecompute}
              type="button"
            >
              {recomputing ? 'Scanning Chain...' : '⚡ Recompute from Chain'}
            </button>
            {recomputing && (
              <div className={styles.scanningBar}>
                <div className={styles.scanningProgress} />
              </div>
            )}
          </div>

          {/* Metric Reconciliation Grid */}
          <div className={styles.reconciliationGrid}>
            <div className={styles.reconTile}>
              <span className={styles.reconLabel}>Verified Return (30d)</span>
              <span className={styles.reconValue}>+{agent.return30d ?? 31.4}%</span>
              <span className={styles.reconFormula}>
                Σ (Attested Outcomes) / Initial Escrow
              </span>
            </div>
            <div className={styles.reconTile}>
              <span className={styles.reconLabel}>Verified Win Rate</span>
              <span className={styles.reconValue}>{agent.winRate ?? 82}%</span>
              <span className={styles.reconFormula}>
                Math.round(988 Positive / 1,204 Total)
              </span>
            </div>
            <div className={styles.reconTile}>
              <span className={styles.reconLabel}>Tasks Proven</span>
              <span className={styles.reconValue}>{(agent.tasks ?? 1204).toLocaleString('en-US')}</span>
              <span className={styles.reconFormula}>
                ProofLedger.countByAgent({agent.id})
              </span>
            </div>
            <div className={styles.reconTile}>
              <span className={styles.reconLabel}>Avg Response Time</span>
              <span className={styles.reconValue}>{agent.respMinutes.toFixed(1)}m</span>
              <span className={styles.reconFormula}>
                Median(executedAt − registeredAt)
              </span>
            </div>
          </div>

          {/* Raw Proof Ledger Section */}
          <section className={styles.ledgerSection}>
            <div className={styles.ledgerHeader}>
              <h2 className={styles.sectionTitle}>
                Raw On-Chain Proof Ledger
                <span className={styles.sectionBadge}>Append-Only</span>
              </h2>

              <div className={styles.controlsRow}>
                <input
                  className={styles.searchInput}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search intent or hash..."
                  type="text"
                  value={searchQuery}
                />

                <div className={styles.filterTabs}>
                  <button
                    className={`${styles.tabBtn} ${filterTab === 'all' ? styles.tabBtnActive : ''}`}
                    onClick={() => setFilterTab('all')}
                    type="button"
                  >
                    All ({records.length})
                  </button>
                  <button
                    className={`${styles.tabBtn} ${filterTab === 'win' ? styles.tabBtnActive : ''}`}
                    onClick={() => setFilterTab('win')}
                    type="button"
                  >
                    Profitable
                  </button>
                  <button
                    className={`${styles.tabBtn} ${filterTab === 'loss' ? styles.tabBtnActive : ''}`}
                    onClick={() => setFilterTab('loss')}
                    type="button"
                  >
                    Losses
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Record ID</th>
                    <th>Pre-Registered → Executed</th>
                    <th>Pre-Registered Intent</th>
                    <th>Outcome</th>
                    <th>Intent Hash</th>
                    <th>Links</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => {
                    const isOpen = expandedId === r.id
                    const isWin = r.outcome > 0
                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          className={`${styles.row} ${isOpen ? styles.rowOpen : ''}`}
                          onClick={() => setExpandedId(isOpen ? null : r.id)}
                        >
                          <td className={styles.recordId}>#{r.id}</td>
                          <td className={styles.timeCol}>
                            {r.registeredAt} <span className={styles.arrow}>→</span> {r.executedAt}
                          </td>
                          <td className={styles.intentText} title={r.intent}>
                            {r.intent}
                          </td>
                          <td>
                            <span className={isWin ? styles.outcomeWin : styles.outcomeLoss}>
                              {isWin ? '+' : '−'}${Math.abs(r.outcome).toFixed(2)} ✓
                            </span>
                          </td>
                          <td className={styles.hashCol}>
                            <span>{r.intentHash}</span>
                            <button
                              className={styles.copyHashBtn}
                              onClick={(e) => {
                                e.stopPropagation()
                                copyText(r.intentHash, `hash-${r.id}`)
                              }}
                              type="button"
                            >
                              {copiedHash === `hash-${r.id}` ? '✓' : '📋'}
                            </button>
                          </td>
                          <td>
                            <a
                              className={styles.extLink}
                              href="https://bscscan.com"
                              onClick={(e) => e.stopPropagation()}
                              rel="noreferrer"
                              target="_blank"
                            >
                              tx ↗
                            </a>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className={styles.detailRow}>
                            <td colSpan={6}>
                              <motion.div
                                animate={{ height: 'auto', opacity: 1 }}
                                className={styles.detailGrid}
                                initial={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: EASE }}
                              >
                                <div className={styles.detailItem}>
                                  <span className={styles.detailKey}>Intent Hash</span>
                                  <span className={styles.detailVal}>{r.intentHash}</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailKey}>Attested Block</span>
                                  <span className={styles.detailVal}>{r.block.toLocaleString('en-US')}</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailKey}>Expiry Deadline</span>
                                  <span className={styles.detailVal}>{r.deadline}</span>
                                </div>
                                <div className={styles.detailItem}>
                                  <span className={styles.detailKey}>Attesting Ledger</span>
                                  <span className={styles.detailVal}>ProofLedger (0x5a1...8c4)</span>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={styles.toast}>
          <span className={styles.toastDot} />
          <span>{toastMessage}</span>
        </div>
      )}

      <SiteFooter />
    </div>
  )
}

import React from 'react'
