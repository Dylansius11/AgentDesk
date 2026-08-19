'use client'

import type { Agent, DashboardEvent } from '@agentdesk/sdk'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import shared from '@/components/landing/landing-section.module.css'
import SiteFooter from '@/components/landing/site-footer'
import SiteNavbar from '@/components/site-navbar'
import Sparkline from '@/components/sparkline'
import { client } from '@/lib/agentdesk-client'
import styles from './dashboard-page.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface FeedEvent {
  time: string
  text: string
  proof: string
  note: string
  label: string
  href: string
  spend: number
}

const FEED_CAP = 6

function eventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function explorerTx(chainId: Agent['chainId'], txHash: string): string {
  const base = chainId === 97 ? 'https://testnet.bscscan.com' : 'https://bscscan.com'
  return `${base}/tx/${txHash}`
}

function feedEvent(event: DashboardEvent, chainId: Agent['chainId']): FeedEvent | null {
  if (event.type === 'decision_registered') {
    return {
      time: eventTime(event.at),
      text: event.record.decision.action.plainText,
      proof: `#${event.record.recordId}`,
      note: `pre-registered ${eventTime(event.record.decision.registeredAt)} ✓`,
      label: 'tx ↗',
      href: explorerTx(chainId, event.record.decision.registeredTx),
      spend: event.record.decision.action.sizeUsd1,
    }
  }
  if (event.type === 'outcome_attested' && event.record.outcome) {
    const outcome = event.record.outcome
    return {
      time: eventTime(event.at),
      text: `Proof sealed: #${event.record.recordId} ${outcome.status} ${outcome.pnlUsd1 >= 0 ? '+' : '−'}$${Math.abs(outcome.pnlUsd1).toFixed(2)}`,
      proof: `#${event.record.recordId}`,
      note: outcome.resolutionSource,
      label: 'evidence ↗',
      href: explorerTx(chainId, outcome.attestedTx),
      spend: 0,
    }
  }
  return null
}

export default function DashboardPage({
  agentId = '4001',
  jobId = 'job-nina-healthguard-0001',
}: {
  agentId?: string
  jobId?: string
}) {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [stopped, setStopped] = useState(false)
  const [stoppedAt, setStoppedAt] = useState<string | null>(null)
  const [stopArmed, setStopArmed] = useState(false)
  const [feed, setFeed] = useState<(FeedEvent & { key: number })[]>([])
  const [pnl, setPnl] = useState(0)
  const [spend, setSpend] = useState(0)
  const [spark, setSpark] = useState<number[]>([0, 0])
  const [flash, setFlash] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const eventKey = useRef(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    client.getAgent(agentId).then((result) => {
      if (!cancelled) setAgent(result)
    })
    return () => {
      cancelled = true
    }
  }, [agentId])

  useEffect(() => {
    if (!agent || stopped) return
    let active = true
    const events = client.getDashboard(jobId)

    const consume = async () => {
      try {
        for await (const event of events) {
          if (!active) return
          if (event.type === 'pnl_update') {
            setPnl(event.cumulativePnlUsd1)
            setSpark((current) => [...current, event.cumulativePnlUsd1].slice(-12))
            setFlash(true)
            setTimeout(() => setFlash(false), 700)
            continue
          }
          if (event.type === 'session_revoked') {
            const time = eventTime(event.revokedAt)
            setStoppedAt(time)
            setStopped(true)
            setToast(`Revoked at ${time}`)
            setTimeout(() => setToast(null), 3200)
            return
          }
          const row = feedEvent(event, agent.chainId)
          if (!row) continue
          eventKey.current += 1
          setFeed((current) => [{ ...row, key: eventKey.current }, ...current].slice(0, FEED_CAP))
          if (row.spend > 0) {
            setSpend((current) =>
              Math.min(agent.trustPanel.spendCapUsd1, current + row.spend),
            )
          }
        }
      } catch {
        if (active) setToast('The demo feed could not be loaded.')
      }
    }

    void consume()
    return () => {
      active = false
      void events.return(undefined)
    }
  }, [agent, jobId, stopped])

  const armOrStop = async () => {
    if (stopped) return
    if (!stopArmed) {
      setStopArmed(true)
      setTimeout(() => setStopArmed(false), 3000)
      return
    }
    setStopArmed(false)
    try {
      const session = await client.revoke(jobId)
      const revokedAt = session.session.revokedAt ?? new Date().toISOString()
      const time = eventTime(revokedAt)
      setStoppedAt(time)
      setStopped(true)
      setToast(`Revoked at ${time}`)
      setTimeout(() => setToast(null), 3200)
    } catch {
      setToast('Could not stop this session — try again.')
      setTimeout(() => setToast(null), 3200)
    }
  }

  if (!agent) {
    return (
      <div className={styles.page}>
        <SiteNavbar />
        <main className={shared.section}>
          <div className={shared.container}>
            <p className={shared.eyebrow}>
              <span className={shared.eyebrowDot} />
              Dashboard
            </p>
            <h1 className={styles.heading}>Loading your agents…</h1>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  const spendCap = agent.trustPanel.spendCapUsd1

  return (
    <div className={styles.page}>
      <SiteNavbar />
      <main className={shared.section}>
        <div className={shared.container}>
          <p className={shared.eyebrow}>
            <span className={shared.eyebrowDot} />
            Dashboard
          </p>
          <h1 className={styles.heading}>Your agents.</h1>

          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>$200</span>
              <span className={styles.statLabel}>under management</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statValue} ${flash ? styles.statFlash : ''}`}>
                {pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toFixed(2)}
              </span>
              <span className={styles.statLabel}>P&L since hire</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stopped ? 0 : 1}</span>
              <span className={styles.statLabel}>active</span>
            </div>
          </div>

          <div className={`${styles.hireCard} ${stopped ? styles.hireCardStopped : ''}`}>
            <div className={styles.cardTop}>
              <div className={styles.identity}>
                <span className={styles.avatar}>{agent.name.charAt(0)}</span>
                <div>
                  <span className={styles.agentName}>{agent.name}</span>
                  <span className={styles.agentTagline}>{agent.tagline}</span>
                </div>
              </div>
              {stopped ? (
                <span className={styles.stoppedPill}>Stopped at {stoppedAt ?? 'now'}</span>
              ) : (
                <button className={styles.stopButton} onClick={() => void armOrStop()} type="button">
                  {stopArmed ? 'Tap again to stop' : 'STOP'}
                </button>
              )}
            </div>

            <div className={styles.cardBody}>
              <div className={styles.feed} aria-live="polite">
                <AnimatePresence initial={false}>
                  {feed.map((event) => (
                    <motion.div
                      animate={{ y: 0, opacity: 1 }}
                      className={styles.feedRow}
                      initial={reduceMotion ? false : { y: -14, opacity: 0 }}
                      key={event.key}
                      transition={
                        reduceMotion ? { duration: 0 } : { duration: 0.25, ease: EASE }
                      }
                    >
                      <span className={styles.feedTime}>{event.time}</span>
                      <span className={styles.feedText}>
                        {event.text} · proof {event.proof} {event.note}
                      </span>
                      <a
                        className={styles.feedLink}
                        href={event.href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {event.label}
                      </a>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {feed.length === 0 && (
                  <p className={styles.feedWaiting}>waiting for first action…</p>
                )}
              </div>

              <div className={styles.side}>
                <div className={styles.sideBlock}>
                  <span className={styles.sideLabel}>Spend today</span>
                  <div className={styles.spendTrack}>
                    <motion.div
                      animate={{ width: `${spendCap > 0 ? (spend / spendCap) * 100 : 0}%` }}
                      className={styles.spendFill}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: EASE }}
                    />
                  </div>
                  <span className={styles.spendReadout}>
                    ${spend.toFixed(2)} / ${spendCap.toFixed(2)}
                  </span>
                </div>
                <div className={styles.sideBlock}>
                  <span className={styles.sideLabel}>P&L since hire</span>
                  <span className={`${styles.pnlCounter} ${flash ? styles.statFlash : ''}`}>
                    {pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toFixed(2)}
                  </span>
                </div>
                <div className={styles.sideBlock}>
                  <span className={styles.sideLabel}>Health factor trend</span>
                  <Sparkline className={styles.spark} values={spark} />
                </div>
              </div>
            </div>
          </div>

          {stopped && (
            <div className={styles.stoppedPanel}>
              <div>
                <p className={styles.stoppedHeading}>No agents working for you right now.</p>
                <p className={styles.stoppedSub}>
                  {agent.name} ran {(agent.metrics?.tasksResolved ?? 0).toLocaleString('en-US')}{' '}
                  proven tasks before you stopped it.
                </p>
              </div>
              <div className={styles.stoppedActions}>
                <Link className={styles.blackPill} href="/marketplace">
                  Hire another agent →
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {!stopped && (
        <div className={styles.stickyStop}>
          <button
            className={styles.stopButtonWide}
            onClick={() => void armOrStop()}
            type="button"
          >
            {stopArmed ? 'Tap again to stop — effective immediately' : 'STOP'}
          </button>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
      <SiteFooter />
    </div>
  )
}
