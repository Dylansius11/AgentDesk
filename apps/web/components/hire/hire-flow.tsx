'use client'

import { type Agent, ERC8183_ADDRESSES, erc20Abi } from '@agentdesk/sdk'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAccount, useBalance, useDisconnect, useReadContract } from 'wagmi'
import SiteNavbar from '@/components/site-navbar'
import { ConnectWalletButton, shortenAddress } from '@/components/wallet/connect-wallet-button'
import { client, isFixtureMode } from '@/lib/agentdesk-client'
import { type HireStage, useHireJob } from '@/lib/use-hire-job'
import styles from './hire-flow.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

type Duration = '24h' | '3d' | '7d'

const DURATIONS: { id: Duration; label: string }[] = [
  { id: '24h', label: '24 hours' },
  { id: '3d', label: '3 days' },
  { id: '7d', label: '7 days' },
]

const LIVE_HIRE_STAGE_LABEL: Record<Exclude<HireStage, null>, string> = {
  negotiate: 'Negotiating with seller',
  create: 'Creating ERC-8183 job',
  register: 'Registering evaluator policy',
  budget: 'Setting escrow budget',
  approve: 'Approving $U for escrow',
  fund: 'Funding escrow',
}

const LIVE_HIRE_TRANSACTION_LABELS = [
  'Create job',
  'Register policy',
  'Set budget',
  'Approve $U',
  'Fund escrow',
] as const

function expiryLabel(duration: Duration): string {
  const days = duration === '24h' ? 1 : duration === '3d' ? 3 : 7
  const date = new Date(Date.now() + days * 86_400_000)
  return `until ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, 18:00`
}

function formatToken(value: bigint | undefined, decimals = 18): string {
  if (value === undefined) return '0'
  const scaled = Number(value) / 10 ** decimals
  if (scaled > 0 && scaled < 0.0001) return '<0.0001'
  return scaled.toLocaleString('en-US', { maximumFractionDigits: 4 })
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
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()
  const { hire, state: hireState } = useHireJob()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const usdBalance = useReadContract({
    address: ERC8183_ADDRESSES.usdToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: isConnected },
  })
  const gasBalance = useBalance({ address, query: { enabled: isConnected } })
  const isLiveHire = agent.execution !== undefined
  const liveHireUnavailable = !isLiveHire && !isFixtureMode
  const escrow = isLiveHire ? agent.pricePerTaskUsd1 : agent.pricePerTaskUsd1 * 3 * 1.03
  // Real fixtures grant exactly one allowlist entry per agent — its plain-English
  // label IS the "what it may do" sentence (CLAUDE.md §1: Nina test).
  const primaryEntry = agent.trustPanel.allowlist[0]
  const action = primaryEntry?.label ?? 'act on your behalf'
  const actionSentence = action
    .replace(/\s+- nothing else$/, '')
    .replace(/^./, (c) => c.toLowerCase())

  const sentence = useMemo(() => {
    if (isLiveHire) {
      return `${agent.name} may ${actionSentence} under the approved task context. It will fund one $${escrow.toFixed(2)} live ERC-8183 escrow job. The seller's negotiated terms define the deliverable. It cannot withdraw.`
    }
    if (!allowPrimary) return 'Select the action permission to continue.'
    return `${agent.name} may ${actionSentence} with at most $${cap} per day, ${expiryLabel(duration)}. It cannot withdraw. You can stop it anytime.`
  }, [actionSentence, allowPrimary, agent.name, cap, duration, escrow, isLiveHire])

  const risk = !allowPrimary || cap <= 25 ? 'Low' : cap >= 200 ? 'High' : 'Medium'

  const authRows = isLiveHire
    ? [
        'Create the job, register its policy, and set its budget (3 confirmations)',
        `Approve $U and fund escrow (2 confirmations, $${escrow.toFixed(2)})`,
      ]
    : [
        'Grant limited access - exactly the limits above',
        `Fund escrow: $${escrow.toFixed(2)} (3 tasks + fee)`,
      ]
  const authorizeCopy = isLiveHire
    ? 'One guided action follows. Your wallet will show five separate confirmations; this bound seller negotiates before the first one.'
    : isFixtureMode
      ? 'Connect your wallet now. This listing has no live seller binding, so grant and escrow remain explicitly simulated.'
      : 'This listing has no live ERC-8183 seller binding. Select a listing with its own binding or switch to fixture mode to simulate a hire.'

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3200)
  }

  const confirmHire = async () => {
    if (!allowPrimary || !primaryEntry) {
      showToast('Select the action permission before continuing.')
      return
    }
    if (!address) {
      showToast('Connect your wallet first.')
      return
    }
    if (liveHireUnavailable) {
      showToast(
        'This listing has no live ERC-8183 seller binding. Select a listing with its own binding or switch to fixture mode.',
      )
      return
    }
    setSubmitting(true)
    try {
      if (agent.execution) {
        const result = await hire({
          execution: agent.execution,
          task: `${agent.name} approved task:\n\n${sentence}\n\nTask context amount: $${amount}\nTask context cap: $${cap} per day\nDuration: ${duration}`,
          budgetU: escrow.toFixed(2),
        })
        if (result.status !== 'done' || result.jobId === null) {
          showToast(result.error ?? 'Could not fund the ERC-8183 escrow.')
          return
        }
        setJobId(result.jobId.toString())
        setSuccess(true)
        return
      }

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

  const liveProgressMessage =
    hireState.status === 'error'
      ? `Escrow flow stopped: ${hireState.error ?? 'unknown error'}`
      : hireState.status === 'done'
        ? 'Escrow funded. The provider now has the on-chain job.'
        : hireState.stage
          ? `${LIVE_HIRE_STAGE_LABEL[hireState.stage]}. Confirm this wallet action to continue.`
          : null
  const liveProgress =
    isLiveHire && liveProgressMessage ? (
      <div className={styles.summaryCard}>
        <span className={styles.fieldLabel}>Live escrow progress</span>
        <p className={styles.sub}>{liveProgressMessage}</p>
        {hireState.txs.length > 0 && (
          <div className={styles.txRows}>
            {hireState.txs.map((hash, index) => (
              <div className={styles.txRow} key={hash}>
                <span>{LIVE_HIRE_TRANSACTION_LABELS[index] ?? `Transaction ${index + 1}`}</span>
                <a
                  className={styles.txHash}
                  href={`https://testnet.bscscan.com/tx/${hash}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {hash}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null

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
              <h1 className={styles.title}>
                {isLiveHire
                  ? `${agent.name} escrow is funded.`
                  : `${agent.name} is working for you.`}
              </h1>
              <p className={styles.sentence}>{sentence}</p>
              {liveProgress}

              {isLiveHire ? (
                <p className={styles.stopNote}>
                  On-chain cancellation is not wired in this escrow flow. Track the funded job and
                  its provider through the transaction hashes above.
                </p>
              ) : (
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
              )}

              {isLiveHire && jobId && <p className={styles.sub}>On-chain ERC-8183 job #{jobId}</p>}
              {!isLiveHire && jobId && (
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
              {isLiveHire && (
                <p className={styles.sub}>
                  This live seller receives these limits as task context. It funds one $$
                  {escrow.toFixed(2)}
                  escrow job and cannot manage assets or withdraw outside its negotiated scope.
                </p>
              )}

              <label className={styles.fieldLabel} htmlFor="amount">
                {isLiveHire ? 'Task context amount' : 'Amount to manage'}
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
                {isLiveHire ? 'Task context cap' : 'Daily spend cap'}
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
              <p className={styles.sub}>{authorizeCopy}</p>

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
                      <span className={styles.balanceText}>
                        {formatToken(usdBalance.data as bigint | undefined, 18)} $U ·{' '}
                        {formatToken(gasBalance.data?.value, gasBalance.data?.decimals)} tBNB
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
                    <span className={styles.authCheck}>{i + 2}</span>
                    <span className={styles.authLabel}>{label}</span>
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
                  disabled={!isConnected || liveHireUnavailable}
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
                  <span>{isLiveHire ? 'Task context amount' : 'Amount to manage'}</span>
                  <span>${amount}</span>
                  <span>{isLiveHire ? 'Escrow budget' : 'Price per completed task'}</span>
                  <span>${agent.pricePerTaskUsd1.toFixed(2)}</span>
                  <span>
                    {isLiveHire ? 'One ERC-8183 escrow job' : 'Escrow (3 tasks + 3% fee)'}
                  </span>
                  <span>${escrow.toFixed(2)}</span>
                </div>
              </div>
              {liveProgress}
              <p className={styles.sub}>
                {isLiveHire
                  ? 'The bound seller negotiates before the first wallet confirmation. Each required transaction and hash remains visible.'
                  : 'Charged only when a task completes. Everything else stays in your wallet.'}
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
                  {submitting
                    ? 'Waiting for wallet…'
                    : isLiveHire
                      ? `Fund ${agent.name} with 5 confirmations ▸`
                      : `Start ${agent.name} ▸`}
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
