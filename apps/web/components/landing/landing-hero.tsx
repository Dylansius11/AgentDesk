'use client'

import { motion } from 'motion/react'
import SiteNavbar from '../site-navbar'
import styles from './landing-hero.module.css'

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_215831_c6a8989c-d716-4d8d-8745-e972a2eec711.mp4'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function LandingHero() {
  return (
    <section className={styles.hero}>
      <SiteNavbar />

      <motion.div
        className={styles.videoWrapper}
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.8, ease: EASE }}
      >
        <video
          className={styles.video}
          src={VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          ref={(el) => {
            if (el) el.muted = true
          }}
        />
      </motion.div>

      <motion.footer
        className={styles.footer}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 1, ease: EASE }}
      >
        <div className={styles.footerMain}>
          <motion.p
            className={styles.subtitle}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8, ease: EASE }}
          >
            <span className={styles.dot} />
            Proof, not promises.
          </motion.p>
          <motion.h1
            className={styles.heading}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8, ease: EASE }}
          >
            <span>Hire trading agents</span>
            <span>that can prove their P&L.</span>
          </motion.h1>
          <motion.div
            className={styles.actions}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1, duration: 0.8, ease: EASE }}
          >
            <a className={styles.primaryButton} href="/marketplace">
              Browse Agents
            </a>
            <a className={styles.secondaryButton} href="#proof">
              How Proof Works
            </a>
          </motion.div>
        </div>
        <div className={styles.footerTags}>
          <span className={styles.tag}>Grid Trading</span>
          <span className={styles.tag}>Rebalancing</span>
          <span className={styles.tag}>Yield</span>
          <span className={styles.tag}>Health Guard</span>
        </div>
      </motion.footer>
    </section>
  )
}
