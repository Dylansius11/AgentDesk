'use client'

import type { Agent } from '@agentdesk/sdk'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import SiteNavbar from '@/components/site-navbar'
import { ConnectWalletButton, shortenAddress } from '@/components/wallet/connect-wallet-button'
import { client } from '@/lib/agentdesk-client'
import styles from './hire-flow.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

type Duration = '24h' | '3d' | '7d'

const DURATIONS: { id: Duration; label: string }[] = [
  { id: '24h', label: '24 hours' },
  { id: '3d', label: '3 days' },
  { id: '7d', label: '7 days' },
]

function expiryLabel(duration: Duration): string {
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
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null
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
  const [cap, setCap] = useState(agent.trustPanel.spendCapUsd1)
  const [duration, setDuration] = useState<Duration>('7d')
  const [allowPrimary, setAllowPrimary] = useState(true)
  const [authDone, setAuthDone] = useState(0)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  // Real fixtures grant exactly one allowlist entry per agent — its plain-English
  // label IS the "what it may do" sentence (CLAUDE.md §1: Nina test).
  const primaryEntry = agent.trustPanel.allowlist[0]
  const action = primaryEntry?.label ?? 'act on your behalf'
  const actionSentence = action.replace(/\s+- nothing else$/, '').replace(/^./, (c) => c.toLowerCase())
  const escrow = agent.pricePerTaskUsd1 * 3 * 1.03

  const sentence = useMemo(() => {
    if (!allowPrimary) return 'Select the action permission to continue.'
    return `${agent.name} may ${actionSentence} with at most $${cap} per day, ${expiryLabel(duration)}. It cannot withdraw. You can stop it anytime.`
  }, [actionSentence, allowPrimary, agent.name, cap, duration])

  const risk = !allowPrimary || cap <= 25 ? 'Low' : cap >= 200 ? 'High' : 'Medium'


  // Step 2 is strictly sequential: connect wallet FIRST, then the two
  // simulated on-chain rows (grant + fund) auto-complete with a stagger.
  // The grant/fund timers only start once the wallet is actually connected.
  useEffect(() => {
    if (step !== 2) return
    setAuthDone(0)
  }, [step])

  useEffect(() => {
    if (step !== 2 || !isConnected) {
      setAuthDone(0)
      return
    }
    const timers = [0, 1].map((i) => setTimeout(() => setAuthDone(i + 1), (i + 1) * 1000))
    return () => timers.forEach(clearTimeout)
  }, [step, isConnected])
  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3200)
  }

  // Two on-chain steps are still fixtures-backed in Phase B (the real ERC-8183
  // create → fund flow lands next); only wallet connect is live today.
  const authRows = [
    'Grant limited access - exactly the limits above',
    `Fund escrow: $${escrow.toFixed(2)} (3 tasks + fee)`,
  ]

  const confirmHire = async () => {
    if (!allowPrimary || !primaryEntry) {
      showToast('Select the action permission before continuing.')
      return
    }
    if (!address) {
      showToast('Connect your wallet first.')
      return
    }
    setSubmitting(true)
    try {
      const session = await client.hire({
        agentId: agent.id,
        hirerAddress: address,
        config: {
          amountUsd1: amount,
          spendCapUsd1: cap,
          spendCapWindow: 'day',
          durationDays: duration === '24h' ? 1 : duration === '3d' ? 3 : 7,
          allowlist: [primaryEntry],
        },
      })
      setJobId(session.id)
      setSuccess(true)
    } catch {
      showToast('Could not start this session - try again.')
    } finally {
      setSubmitting(false)
    }
  }

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
              transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE }}
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
                  onClick={async () => {
                    if (jobId) await client.revoke(jobId)
                    showToast('Session revoked - effective next block.')
                  }}
                  type="button"
                >
                  STOP
                </button>
                <p className={styles.stopNote}>
                  This is your stop button. It's always one tap away - effective immediately.
                </p>
              </div>

              {jobId && (
                <Link
                  className={styles.blackPill}
                  href={`/dashboard?jobId=${encodeURIComponent(jobId)}&agentId=${encodeURIComponent(agent.id)}`}
                >
                  Go to dashboard →
                </Link>
              )}
            </div>
          ) : step === 1 ? (
            <div className={styles.stepBody}>
              <h1 className={styles.title}>Set your limits.</h1>
              <p className={styles.sub}>Safety made friendly - plain sentences, exact caps.</p>

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
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </span>
                  <span className={styles.toggleTrack}>
                    <span className={`${styles.toggleKnob} ${allowPrimary ? styles.knobOn : ''}`} />
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
                <button
                  className={styles.blackPill}
                  disabled={!allowPrimary}
                  onClick={() => setStep(2)}
                  type="button"
                >
                  Continue →
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            <div className={styles.stepBody}>
              <h1 className={styles.title}>Authorize.</h1>
              <p className={styles.sub}>
                Connect your wallet now. The grant and escrow steps are simulated until the live
                ERC-8183 flow lands.
              </p>

              <div className={styles.authList}>
                <div className={styles.authRow}>
                  <span className={isConnected ? styles.authCheckDone : styles.authCheck}>
                    {isConnected ? '✓' : 1}
                  </span>
                  {isConnected && address ? (
                    <span className={styles.connectedRow}>
                      <span className={styles.authLabelDone}>
                        Wallet connected - {shortenAddress(address)}
                      </span>
                      <button
                        className={styles.disconnectButton}
                        onClick={() => disconnect()}
                        type="button"
                      >
                        Disconnect
                      </button>
                    </span>
                  ) : (
                    <ConnectWalletButton className={styles.authConnect} />
                  )}
                </div>

                {authRows.map((label, i) => (
                  <div className={styles.authRow} key={label}>
                    <span
                      className={
                        isConnected && authDone > i ? styles.authCheckDone : styles.authCheck
                      }
                    >
                      {isConnected && authDone > i ? '✓' : i + 2}
                    </span>
                    <span
                      className={
                        isConnected && authDone > i ? styles.authLabelDone : styles.authLabel
                      }
                    >
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
                  disabled={!isConnected || authDone < 2}
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
                  <span>${agent.pricePerTaskUsd1.toFixed(2)}</span>
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
                <button
                  className={styles.blackPill}
                  disabled={submitting}
                  onClick={confirmHire}
                  type="button"
                >
                  {submitting ? 'Starting…' : `Start ${agent.name} ▸`}
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
