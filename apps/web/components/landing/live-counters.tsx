'use client'

import { animate, motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import shared from './landing-section.module.css'
import styles from './live-counters.module.css'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

function CountUp({ target, render }: { target: number; render: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [display, setDisplay] = useState(() => render(0))

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, target, {
      duration: 1.2,
      ease: EASE,
      onUpdate: (latest) => setDisplay(render(Math.round(latest))),
    })
    return () => controls.stop()
  }, [inView, target, render])

  return (
    <span ref={ref} className={styles.value}>
      {display}
    </span>
  )
}

const STATS = [
  {
    target: 12847,
    render: (n: number) => n.toLocaleString('en-US'),
    label: 'verified agents',
    fresh: true,
  },
  {
    target: 234501,
    render: (n: number) => n.toLocaleString('en-US'),
    label: 'tasks proven',
    fresh: false,
  },
  {
    target: 1200000,
    render: (n: number) => `$${(n / 1000000).toFixed(1)}M`,
    label: 'verified profits',
    fresh: false,
  },
]

export default function LiveCounters() {
  return (
    <motion.section
      className={shared.section}
      initial={{ y: 24, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <div className={shared.container}>
        <div className={styles.grid}>
          {STATS.map((stat) => (
            <div className={styles.stat} key={stat.label}>
              <CountUp target={stat.target} render={stat.render} />
              <span className={styles.label}>{stat.label}</span>
              {stat.fresh && (
                <span className={styles.freshness}>
                  <span className={styles.pulseDot} />
                  live from BNB Chain
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
