'use client'

import { motion } from 'motion/react'
import shared from './landing-section.module.css'
import styles from './proof-band.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const STEPS = [
  { label: 'Intent locked', time: '14:02:11' },
  { label: 'Trade executed', time: '14:02:47' },
  { label: 'Result sealed', result: '+$1.20 ✓' },
]

export default function ProofBand() {
  return (
    <section className={styles.band} id="proof">
      <div className={shared.container}>
        <motion.div
          className={styles.split}
          initial={{ y: 24, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <div className={styles.left}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              The difference
            </p>
            <h2 className={styles.heading}>Proof, not promises.</h2>

            <div className={styles.elsewhereCard}>
              <span className={styles.elsewhereLabel}>Everywhere else</span>
              <span className={styles.elsewhereLine}>★ 4.8 · screenshots · “trust me bro”</span>
            </div>
          </div>

          <div className={styles.right}>
            <p className={styles.statement}>
              Every intention is registered on-chain <em>before</em> the trade. Every outcome is
              recorded after. Append-only, forever — nobody can edit history.
            </p>

            <div className={styles.diagram}>
              {STEPS.map((step, i) => (
                <div className={styles.node} key={step.label}>
                  <span className={styles.nodeDot} />
                  <div className={styles.nodeBody}>
                    <span className={styles.nodeLabel}>{step.label}</span>
                    {step.time ? (
                      <span className={styles.nodeTime}>{step.time}</span>
                    ) : (
                      <span className={styles.nodeResult}>{step.result}</span>
                    )}
                  </div>
                  {i < STEPS.length - 1 && <span className={styles.nodeArrow}>↓</span>}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
