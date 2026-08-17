"use client";

import { Plus } from "lucide-react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./site-navbar.module.css";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function SiteNavbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  // pick up the correct state on load (e.g. scroll restoration), then track
  useEffect(() => {
    setScrolled(window.scrollY > 24);
  }, []);
  useMotionValueEvent(scrollY, "change", (value) => {
    setScrolled(value > 24);
  });

  return (
    <motion.header
      className={`${styles.navbar} ${scrolled ? styles.navbarFloating : ""}`}
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <div className={styles.navLeft}>
        <a className={styles.logo} href="/">
          <Image
            alt=""
            className={styles.logoIcon}
            height={22}
            src="/logo.png"
            width={22}
          />
          <span className={styles.brand}>AgentDesk</span>
        </a>
        <nav className={styles.navLinks}>
          <a className={styles.navLink} href="/marketplace">
            Marketplace
          </a>
          <a className={styles.navLink} href="/leaderboard">
            Leaderboard
          </a>
          <a className={styles.navLink} href="/dashboard">
            Dashboard
          </a>
          <a className={styles.navLink} href="/verify">
            Verify
          </a>
        </nav>
      </div>
      <div className={styles.navRight}>
        <button className={styles.systemsButton} type="button">
          <span className={styles.systemsCircle}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <circle cx="3" cy="3" r="1.6" fill="currentColor" />
              <circle cx="9" cy="3" r="1.6" fill="currentColor" />
              <circle cx="3" cy="9" r="1.6" fill="currentColor" />
              <circle cx="9" cy="9" r="1.6" fill="currentColor" />
            </svg>
          </span>
          <span className={styles.systemsLabel}>Built on BNB Chain</span>
        </button>
      </div>
    </motion.header>
  );
}
