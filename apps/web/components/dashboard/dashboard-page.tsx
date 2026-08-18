'use client'

import type { Agent } from '@agentdesk/sdk'
import { AnimatePresence, motion } from 'motion/react'
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
  link: string
  pnl: number
  spend: number
}

/* the scripted demo sequence from the product docs, loops while active */
const SCRIPT: FeedEvent[] = [
  {
    time: '14:02:47',
    text: 'Bought 12 CAKE @ $2.08',
    proof: '#4821',
    note: 'pre-registered 14:02:11 ✓',
    link: 'tx ↗',
    pnl: 0,
    spend: 0.8,
  },
  {
    time: '14:07:12',
    text: 'Grid level hit — sold 12 CAKE @ $2.21 (+$1.20)',
    proof: '#4822',
    note: 'pre-registered 14:02:36 ✓',
    link: 'tx ↗',
    pnl: 1.2,
    spend: 0.8,
  },
  {
    time: '14:31:05',
    text: 'Volatility spike — widened grid band',
    proof: '#4823',
    note: 'pre-registered 14:28:50 ✓',
    link: 'tx ↗',
    pnl: 0,
    spend: 0.4,
  },
  {
    time: '15:00:00',
    text: 'Proof sealed: #4822 resolved +$1.20 ✓',
    proof: '#4822',
    note: 'attested on-chain',
    link: 'evidence ↗',
    pnl: 0,
    spend: 0,
  },
  {
    time: '15:12:39',
    text: 'Bought 12 CAKE @ $2.06',
    proof: '#4824',
    note: 'pre-registered 15:11:58 ✓',
    link: 'tx ↗',
    pnl: 0,
    spend: 0.8,
  },
  {
    time: '15:19:04',
    text: 'Grid level hit — sold 12 CAKE @ $2.19 (+$1.56)',
    proof: '#4825',
    note: 'pre-registered 15:18:02 ✓',
    link: 'tx ↗',
    pnl: 1.56,
    spend: 0.8,
  },
]

const FEED_CAP = 6

export default function DashboardPage() {
  // "1001" = GridGoblin, the scripted demo session (packages/sdk fixtures/agents/grid.ts)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [stopped, setStopped] = useState(false)
  const [stopArmed, setStopArmed] = useState(false)
  const [feed, setFeed] = useState<(FeedEvent & { key: number })[]>([])
  const [pnl, setPnl] = useState(3.4)
  const [spend, setSpend] = useState(12.4)
  const [spark, setSpark] = useState<number[]>([3, 3.1, 3.2, 3.3, 3.4])
  const [flash, setFlash] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const scriptIndex = useRef(0)
  const eventKey = useRef(0)

  useEffect(() => {
    let cancelled = false
    client.getAgent('1001').then((result) => {
      if (!cancelled) setAgent(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // the live feed: a scripted event slides in every 5 seconds while active
  useEffect(() => {
    if (stopped || !agent) return
    const push = (event: FeedEvent) => {
      eventKey.current += 1
      setFeed((current) => [{ ...event, key: eventKey.current }, ...current].slice(0, FEED_CAP))
      if (event.pnl > 0) {
        setPnl((value) => value + event.pnl)
        setFlash(true)
        setTimeout(() => setFlash(false), 700)
      }
      if (event.spend > 0) {
        setSpend((value) => Math.min(50, value + event.spend))
      }
      // extend the session curve from its own last point (no stale state reads)
      setSpark((current) => {
        const last = current[current.length - 1] ?? 3.4
        return [...current, last + event.pnl].slice(-12)
      })
    }
    // seed the first event immediately, then tick every 5s
    push(SCRIPT[scriptIndex.current % SCRIPT.length])
    scriptIndex.current += 1
    const timer = setInterval(() => {
      push(SCRIPT[scriptIndex.current % SCRIPT.length])
      scriptIndex.current += 1
    }, 5000)
    return () => clearInterval(timer)
  }, [stopped, agent])

  const armOrStop = () => {
    if (stopped) return
    if (!stopArmed) {
      setStopArmed(true)
      setTimeout(() => setStopArmed(false), 3000)
      return
    }
    setStopped(true)
    setStopArmed(false)
    setToast('Session revoked · effective next block')
    setTimeout(() => setToast(null), 3200)
  }

  const restart = () => {
    scriptIndex.current = 0
    eventKey.current = 0
    setFeed([])
    setPnl(3.4)
    setSpend(12.4)
    setSpark([3, 3.1, 3.2, 3.3, 3.4])
    setStopped(false)
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
                +${pnl.toFixed(2)}
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
                <span className={styles.stoppedPill}>Stopped at 15:42</span>
              ) : (
                <button className={styles.stopButton} onClick={armOrStop} type="button">
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
                      initial={{ y: -14, opacity: 0 }}
                      key={event.key}
                      transition={{ duration: 0.25, ease: EASE }}
                    >
                      <span className={styles.feedTime}>{event.time}</span>
                      <span className={styles.feedText}>
                        {event.text} · proof {event.proof} {event.note}
                      </span>
                      <span className={styles.feedLink}>{event.link}</span>
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
                      animate={{ width: `${(spend / 50) * 100}%` }}
                      className={styles.spendFill}
                      transition={{ duration: 0.6, ease: EASE }}
                    />
                  </div>
                  <span className={styles.spendReadout}>${spend.toFixed(2)} / $50</span>
                </div>
                <div className={styles.sideBlock}>
                  <span className={styles.sideLabel}>P&L since hire</span>
                  <span className={`${styles.pnlCounter} ${flash ? styles.statFlash : ''}`}>
                    +${pnl.toFixed(2)}
                  </span>
                </div>
                <div className={styles.sideBlock}>
                  <span className={styles.sideLabel}>Session</span>
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
                  {agent.name} ran {(agent.metrics?.tasksResolved ?? 0).toLocaleString('en-US')} proven tasks before you stopped it. Hire it again anytime.
                </p>
              </div>
              <div className={styles.stoppedActions}>
                <Link className={styles.blackPill} href="/marketplace">
                  Hire your first agent →
                </Link>
                <button className={styles.ghostButton} onClick={restart} type="button">
                  Restart demo session
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {!stopped && (
        <div className={styles.stickyStop}>
          <button className={styles.stopButtonWide} onClick={armOrStop} type="button">
            {stopArmed ? 'Tap again to stop — effective next block' : 'STOP'}
          </button>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
      <SiteFooter />
    </div>
  )
}
