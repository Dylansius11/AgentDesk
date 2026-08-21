'use client'

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'

/*
 * Scroll-scrubbed entrance for the page finale. The wrapper's top sits exactly
 * at the horizontal section's runway bottom, so its progress stays 0 until the
 * sticky releases — the reveal cannot start early, moves only as the user
 * scrolls, and settles into natural flow once complete.
 */
export default function FinalReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'start 0.65'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 60, 0])
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <motion.div ref={ref} style={{ y, opacity }}>
      {children}
    </motion.div>
  )
}
