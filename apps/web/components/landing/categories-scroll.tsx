'use client'

import { type MotionValue, motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import Link from 'next/link'
import styles from './categories-scroll.module.css'
import shared from './landing-section.module.css'

const CATEGORIES = [
  {
    id: 'grid',
    title: 'Grid Trading',
    tagline: 'Buys the dip, sells the rip — automatically.',
    chip: 'PancakeSwap',
    spark: [3, 4, 3.5, 5, 4.5, 6, 5.5, 7, 6.5, 8],
  },
  {
    id: 'rebalance',
    title: 'Rebalancing',
    tagline: 'Keeps your liquidity in the profitable range.',
    chip: 'LP positions',
    spark: [2, 3, 3, 4, 4.2, 5, 5.1, 6, 6.2, 7],
  },
  {
    id: 'yield',
    title: 'Yield',
    tagline: 'Moves funds to where APY actually is.',
    chip: 'Farms',
    spark: [4, 3.2, 5, 4.6, 6, 5.6, 7, 6.8, 8, 9],
  },
  {
    id: 'health',
    title: 'Health Guard',
    tagline: 'Stops your loan from getting liquidated at 3am.',
    chip: 'Venus',
    spark: [5, 5.4, 5.2, 6, 5.8, 6.4, 6.3, 7, 6.9, 7.5],
  },
]

function sparkPath(values: number[], width: number, height: number, pad = 5) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = (width - pad * 2) / (values.length - 1)
  return values
    .map((value, i) => {
      const x = pad + i * step
      const y = pad + (1 - (value - min) / range) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function Sparkline({ values }: { values: number[] }) {
  const width = 200
  const height = 120
  const line = sparkPath(values, width, height)
  const area = `${line} L${width - 5},${height} L5,${height} Z`
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={area} fill="rgba(0, 0, 0, 0.05)" stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="#000000"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type LayerProps = {
  progress: MotionValue<number>
  index: number
  total: number
}

/*
 * One alternating statement: enters from its own side, holds, exits toward the
 * opposite side. The last step holds so the sticky section releases on a full
 * message instead of an empty stage.
 */
function Step({ progress, index, total, children }: LayerProps & { children: React.ReactNode }) {
  const seg = 1 / total
  const start = index * seg
  const end = start + seg
  const inEnd = start + seg * 0.32
  const outStart = start + seg * 0.68
  const isLast = index === total - 1
  const side = index % 2 === 0 ? 1 : -1
  const reduce = useReducedMotion()
  const amp = reduce ? 0 : 90

  const range = isLast ? [start, inEnd] : [start, inEnd, outStart, end]
  const opacity = useTransform(progress, range, isLast ? [0, 1] : [0, 1, 1, 0])
  const x = useTransform(
    progress,
    range,
    isLast ? [-side * amp, 0] : [-side * amp, 0, 0, side * amp],
  )

  return (
    <motion.div
      className={`${styles.step} ${index % 2 === 0 ? styles.stepLeft : styles.stepRight}`}
      style={{ opacity, x }}
    >
      {children}
    </motion.div>
  )
}

/*
 * One layer of the sticky card stack — crossfades a touch faster than the
 * statement so the visual settles while the text arrives.
 */
function CardLayer({
  progress,
  index,
  total,
  children,
}: LayerProps & { children: React.ReactNode }) {
  const seg = 1 / total
  const start = index * seg
  const end = start + seg
  const fade = seg * 0.18
  const isLast = index === total - 1

  const range = isLast ? [start, start + fade] : [start, start + fade, end - fade, end]
  const opacity = useTransform(progress, range, isLast ? [0, 1] : [0, 1, 1, 0])
  const pointerEvents = useTransform(
    progress,
    range,
    isLast ? ['none', 'auto'] : ['none', 'auto', 'auto', 'none'],
  )

  return (
    <motion.div className={styles.card} style={{ opacity, pointerEvents }}>
      {children}
    </motion.div>
  )
}

export default function CategoriesScroll() {
  const runway = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: runway,
    offset: ['start start', 'end end'],
  })
  /*
   * The runway holds 5 viewports of scroll: 4 statement steps plus a final
   * cover segment during which the proof band slides up over the pinned scene.
   * Steps run on the first 80% of progress; the last 20% is the cover.
   */
  const stepProgress = useTransform(scrollYProgress, [0, 0.8], [0, 1])

  return (
    <section className={styles.outer} id="categories">
      <div className={shared.container}>
        <div className={styles.intro}>
          <p className={shared.eyebrow}>
            <span className={shared.eyebrowDot} />
            Four categories
          </p>
          <h2 className={shared.heading}>Pick how your money works.</h2>
        </div>
      </div>

      {/* runway = steps + cover + release viewports; the proof band covers the tail */}
      <div className={styles.runway} ref={runway}>
        <div className={styles.sticky}>
          <div className={styles.stage}>
            <div className={styles.cardStack}>
              {CATEGORIES.map((category, i) => (
                <CardLayer
                  progress={stepProgress}
                  index={i}
                  key={category.title}
                  total={CATEGORIES.length}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.cardIndex}>{String(i + 1).padStart(2, '0')}</span>
                    <span className={styles.chip}>{category.chip}</span>
                  </div>
                  <h3 className={styles.cardTitle}>{category.title}</h3>
                  <Sparkline values={category.spark} />
                  <div className={styles.cardBottom}>
                    <span className={styles.cardHint}>Verified example</span>
                    <Link className={styles.explore} href={`/marketplace?category=${category.id}`}>
                      Explore <span className={styles.arrow}>→</span>
                    </Link>
                  </div>
                </CardLayer>
              ))}
            </div>

            {CATEGORIES.map((category, i) => (
              <Step
                progress={stepProgress}
                index={i}
                key={category.title}
                total={CATEGORIES.length}
              >
                <p className={styles.stepIndex}>
                  {String(i + 1).padStart(2, '0')} — {category.title}
                </p>
                <p className={styles.stepStatement}>{category.tagline}</p>
              </Step>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
