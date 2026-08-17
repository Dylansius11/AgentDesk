'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import styles from './how-it-works.module.css'
import shared from './landing-section.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const STEPS = [
  {
    title: 'Pick a proven agent',
    body: 'Browse verified track records and pick your match.',
    vignette: 'agent',
  },
  {
    title: 'Set your limits',
    body: 'Daily cap, expiry, exactly what it may do — in plain sentences.',
    vignette: 'limits',
  },
  {
    title: 'Hire in 60 seconds',
    body: 'One confirmation and it starts working. Stop anytime.',
    vignette: 'hired',
  },
]

function Vignette({ kind }: { kind: 'agent' | 'limits' | 'hired' }) {
  if (kind === 'agent') {
    return (
      <div className={styles.vignette}>
        <span className={styles.agentRow}>
          <span className={styles.agentDot} />
          GridGoblin
        </span>
        <span className={styles.verifiedPill}>Verified</span>
      </div>
    )
  }
  if (kind === 'limits') {
    return (
      <div className={styles.vignette}>
        <span className={styles.limitPill}>$50 / day</span>
        <span className={styles.limitPill}>Expires Friday</span>
      </div>
    )
  }
  return (
    <div className={styles.vignette}>
      <span className={styles.activeRow}>
        <span className={styles.activeDot} />
        Active
      </span>
      <span className={styles.stopPill}>STOP</span>
    </div>
  )
}

export default function HowItWorks() {
  const runway = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: runway,
    offset: ['start start', 'end end'],
  })

  /*
   * One viewport of pinned scroll per card: the track slides card→card across
   * the first two viewports, then holds on the final card for the last one
   * before the sticky releases. One viewport width = 100/n % of the track.
   */
  const n = STEPS.length
  const x = useTransform(
    scrollYProgress,
    [0, 1 / n, 2 / n, 1],
    ['0%', `-${100 / n}%`, `-${200 / n}%`, `-${200 / n}%`],
  )
  // the progress bar tracks card movement: fills as the slides advance, then
  // stays full while the last card dwells
  const barScale = useTransform(scrollYProgress, [0, 2 / n], [0, 1])

  return (
    <section className={styles.outer} id="how-it-works">
      <div className={shared.container}>
        <div className={styles.intro}>
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <p className={shared.eyebrow}>
              <span className={shared.eyebrowDot} />
              How it works
            </p>
            <h2 className={shared.heading}>Hire in three steps.</h2>
          </motion.div>
        </div>
      </div>

      {/* runway = (n + 1) viewports: one card per viewport of pinned scroll, then release */}
      <div className={styles.runway} ref={runway}>
        <div className={styles.sticky}>
          <div className={styles.stage}>
            <motion.div className={styles.track} style={{ x }}>
              {STEPS.map((step, i) => (
                <article className={styles.panel} key={step.title}>
                  <span className={styles.index}>{String(i + 1).padStart(2, '0')}</span>
                  <h3 className={styles.title}>{step.title}</h3>
                  <p className={styles.body}>{step.body}</p>
                  <Vignette kind={step.vignette as 'agent' | 'limits' | 'hired'} />
                </article>
              ))}
            </motion.div>

            <div className={styles.progressTrack}>
              <motion.div className={styles.progressBar} style={{ scaleX: barScale }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
