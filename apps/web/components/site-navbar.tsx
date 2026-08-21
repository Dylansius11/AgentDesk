"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { FaucetButton } from "@/components/wallet/faucet-button";
import styles from "./site-navbar.module.css";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LINKS = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/verify", label: "Verify" },
  { href: "/publish", label: "Publish" },
] as const;

export default function SiteNavbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // pick up the correct state on load (e.g. scroll restoration), then track
  useEffect(() => {
    setScrolled(window.scrollY > 24);
  }, []);
  useMotionValueEvent(scrollY, "change", (value) => {
    setScrolled(value > 24);
  });

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
      </div>
      <nav className={styles.navLinks} aria-label="Primary">
        {LINKS.map((link) => (
          <a
            className={`${styles.navLink} ${isActive(link.href) ? styles.navLinkActive : ""}`}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className={styles.navRight}>
        <FaucetButton className={styles.faucetButton} />
        <ConnectWalletButton className={styles.walletButton} />
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
