'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import SiteNavbar from '@/components/site-navbar'
import type { Agent } from '@/lib/mock-agents'
import styles from './hire-flow.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

type Duration = '24h' | '3d' | '7d' | 'until'

const DURATIONS: { id: Duration; label: string }[] = [
  { id: '24h', label: '24 hours' },
  { id: '3d', label: '3 days' },
  { id: '7d', label: '7 days' },
  { id: 'until', label: 'Until I stop' },
]

const PRIMARY_ACTION: Record<Agent['category'], string> = {
  grid: 'trade CAKE/USDT on PancakeSwap',
  rebalancing: 'manage your PancakeSwap v3 positions',
  yield: 'move funds between farms',
  health: 'repay debt on Venus to protect your health factor',
}

function expiryLabel(duration: Duration): string {
  if (duration === 'until') return 'until you stop it'
  const days = duration === '24h' ? 1 : duration === '3d' ? 3 : 7
  const date = new Date(Date.now() + days * 86_400_000)
  return `until ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, 18:00`
}

/* decorative confetti particles, computed once with stable ids */
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: `bit-${i}`,
  x: (i % 2 === 0 ? 1 : -1) * (40 + ((i * 13) % 130)),
  y: 130 + ((i * 29) % 190),
  rotate: (i * 137) % 360,
  delay: (i % 5) * 0.04,
  gray: i % 3 === 0,
}))

function Confetti() {
  return (
    <div aria-hidden="true" className={styles.confetti}>
      {PARTICLES.map((particle) => (
        <motion.span
          animate={{
            x: particle.x,
            y: particle.y,
            rotate: particle.rotate,
            opacity: 0,
          }}
          className={`${styles.confettiBit} ${particle.gray ? styles.confettiGray : ''}`}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          key={particle.id}
          transition={{ duration: 1.3, ease: EASE, delay: particle.delay }}
        />
      ))}
    </div>
  )
}

export default function HireFlow({ agent }: { agent: Agent }) {
  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState(200)
  const [cap, setCap] = useState(50)
  const [duration, setDuration] = useState<Duration>('7d')
  const [allowPrimary, setAllowPrimary] = useState(true)
  const [allowMove, setAllowMove] = useState(true)
  const [authDone, setAuthDone] = useState(0)
  const [success, setSuccess] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const action = PRIMARY_ACTION[agent.category]
  const escrow = agent.pricePerTask * 3 * 1.03

  const sentence = useMemo(() => {
    const verbs = [
      allowPrimary ? action : null,
      allowMove ? 'move funds between approved venues' : null,
    ].filter(Boolean)
    const verbText =
      verbs.length === 0
        ? 'watch your balance only'
        : verbs.length === 1
          ? verbs[0]
          : `${verbs[0]} and ${verbs[1]}`
    return `${agent.name} may ${verbText} with at most $${cap} per day, ${expiryLabel(duration)}. It cannot withdraw. You can stop it anytime.`
  }, [action, allowMove, allowPrimary, agent.name, cap, duration])

  const actionsAllowed = [allowPrimary, allowMove].filter(Boolean).length
  const risk =
    actionsAllowed <= 1 || cap <= 25
      ? 'Low'
      : actionsAllowed === 2 && cap >= 200
        ? 'High'
        : 'Medium'

  // step 2: rows auto-complete one by one with a satisfying stagger
  useEffect(() => {
    if (step !== 2) return
    setAuthDone(0)
    const timers = [0, 1, 2].map((i) => setTimeout(() => setAuthDone(i + 1), (i + 1) * 1000))
    return () => timers.forEach(clearTimeout)
  }, [step])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3200)
  }

  const authRows = [
    'Connect wallet',
    'Grant limited access — exactly the limits above',
    `Fund escrow: $${escrow.toFixed(2)} (3 tasks + fee)`,
  ]

  return (
    <div className={styles.page}>
      <SiteNavbar />

      <main className={styles.main}>
        <div className={styles.card}>
          {/* persistent step progress */}
          <div className={styles.progressTrack}>
            <motion.div
              animate={{ scaleX: success ? 1 : step / 3 }}
              className={styles.progressFill}
              initial={false}
              transition={{ duration: 0.5, ease: EASE }}
            />
          </div>
          <div className={styles.stepLabels}>
            {['1 · Set limits', '2 · Authorize', '3 · Confirm'].map((label, i) => (
              <span
                className={
                  i + 1 === step || (success && i === 2) ? styles.stepLabelActive : styles.stepLabel
                }
                key={label}
              >
                {label}
              </span>
            ))}
          </div>

          {success ? (
            <div className={styles.stepBody}>
              <Confetti />
              <span className={styles.activeRow}>
                <span className={styles.activeDot} /> Active
              </span>
              <h1 className={styles.title}>{agent.name} is working for you.</h1>
              <p className={styles.sentence}>{sentence}</p>

              <div className={styles.stopWrap}>
                <button
                  className={styles.stopButton}
                  onClick={() =>
                    showToast('Session revoked — effective next block. (Live-version behavior.)')
                  }
                  type="button"
                >
                  STOP
                </button>
                <p className={styles.stopNote}>
                  This is your stop button. It's always one tap away — effective immediately.
                </p>
              </div>

              <Link className={styles.blackPill} href="/dashboard">
                Go to dashboard →
              </Link>
            </div>
          ) : step === 1 ? (
            <div className={styles.stepBody}>
              <h1 className={styles.title}>Set your limits.</h1>
              <p className={styles.sub}>Safety made friendly — plain sentences, exact caps.</p>

              <label className={styles.fieldLabel} htmlFor="amount">
                Amount to manage
              </label>
              <div className={styles.amountRow}>
                <input
                  className={styles.amountInput}
                  id="amount"
                  min={50}
                  onChange={(event) => setAmount(Number(event.target.value) || 0)}
                  type="number"
                  value={amount}
                />
                <button className={styles.chipButton} onClick={() => setAmount(200)} type="button">
                  Use suggested
                </button>
              </div>

              <label className={styles.fieldLabel} htmlFor="cap">
                Daily spend cap
              </label>
              <div className={styles.capRow}>
                <input
                  className={styles.capSlider}
                  id="cap"
                  max={500}
                  min={5}
                  onChange={(event) => setCap(Number(event.target.value))}
                  step={5}
                  type="range"
                  value={cap}
                />
                <span className={styles.capReadout}>${cap} / day</span>
              </div>

              <span className={styles.fieldLabel}>Duration</span>
              <div className={styles.pillRow}>
                {DURATIONS.map((option) => (
                  <button
                    className={`${styles.pill} ${duration === option.id ? styles.pillActive : ''}`}
                    key={option.id}
                    onClick={() => setDuration(option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <span className={styles.fieldLabel}>Exactly what it may do</span>
              <div className={styles.allowList}>
                <button
                  aria-checked={allowPrimary}
                  className={styles.allowRow}
                  onClick={() => setAllowPrimary((value) => !value)}
                  role="switch"
                  type="button"
                >
                  <span className={styles.allowText}>
                    {action[0].toUpperCase() + action.slice(1)} — nothing else
                  </span>
                  <span className={styles.toggleTrack}>
                    <span className={`${styles.toggleKnob} ${allowPrimary ? styles.knobOn : ''}`} />
                  </span>
                </button>
                <button
                  aria-checked={allowMove}
                  className={styles.allowRow}
                  onClick={() => setAllowMove((value) => !value)}
                  role="switch"
                  type="button"
                >
                  <span className={styles.allowText}>Move funds between approved venues</span>
                  <span className={styles.toggleTrack}>
                    <span className={`${styles.toggleKnob} ${allowMove ? styles.knobOn : ''}`} />
                  </span>
                </button>
                <div className={`${styles.allowRow} ${styles.allowLocked}`}>
                  <span className={styles.allowText}>Withdraw to my wallet</span>
                  <span className={styles.lockedNote}>Locked off</span>
                </div>
                <p className={styles.lockedCaption}>Withdrawals always stay with you.</p>
              </div>

              <div className={styles.riskRow}>
                <span className={styles.fieldLabel}>Live risk</span>
                <span className={styles.riskValue}>{risk}</span>
              </div>

              <p className={styles.sentencePreview}>{sentence}</p>

              <div className={styles.actions}>
                <Link className={styles.ghostButton} href={`/agent/${agent.id}`}>
                  Cancel
                </Link>
                <button className={styles.blackPill} onClick={() => setStep(2)} type="button">
                  Continue →
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            <div className={styles.stepBody}>
              <h1 className={styles.title}>Authorize.</h1>
              <p className={styles.sub}>
                In the live version these run in your wallet. Here they simulate one by one.
              </p>

              <div className={styles.authList}>
                {authRows.map((label, i) => (
                  <div className={styles.authRow} key={label}>
                    <span className={authDone > i ? styles.authCheckDone : styles.authCheck}>
                      {authDone > i ? '✓' : i + 1}
                    </span>
                    <span className={authDone > i ? styles.authLabelDone : styles.authLabel}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.summaryCard}>
                <span className={styles.fieldLabel}>Permission being granted</span>
                <p className={styles.sentence}>{sentence}</p>
              </div>

              <div className={styles.actions}>
                <button className={styles.ghostButton} onClick={() => setStep(1)} type="button">
                  ← Back
                </button>
                <button
                  className={styles.blackPill}
                  disabled={authDone < 3}
                  onClick={() => setStep(3)}
                  type="button"
                >
                  Continue →
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.stepBody}>
              <h1 className={styles.title}>Confirm.</h1>
              <div className={styles.summaryCard}>
                <p className={styles.sentence}>{sentence}</p>
                <div className={styles.priceRows}>
                  <span>Amount to manage</span>
                  <span>${amount}</span>
                  <span>Price per completed task</span>
                  <span>${agent.pricePerTask.toFixed(2)}</span>
                  <span>Escrow (3 tasks + 3% fee)</span>
                  <span>${escrow.toFixed(2)}</span>
                </div>
              </div>
              <p className={styles.sub}>
                Charged only when a task completes. Everything else stays in your wallet.
              </p>

              <div className={styles.actions}>
                <button className={styles.ghostButton} onClick={() => setStep(2)} type="button">
                  ← Back
                </button>
                <button className={styles.blackPill} onClick={() => setSuccess(true)} type="button">
                  Start {agent.name} ▸
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
