'use client'

import Lenis from 'lenis'
import { useEffect } from 'react'

/*
 * Lenis smooth scrolling on the window. Native scrolling (and sticky
 * positioning) keeps working; `anchors: true` makes in-page hash links glide.
 * Skipped entirely for users who prefer reduced motion.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      anchors: true,
      duration: 1.1,
    })

    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return null
}
