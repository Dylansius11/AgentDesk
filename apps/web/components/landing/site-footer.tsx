import Image from "next/image";
import shared from "./landing-section.module.css";
import styles from "./site-footer.module.css";

const LINKS = [
  { href: "/#categories", label: "Categories" },
  { href: "/#proof", label: "Proof" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/marketplace", label: "Marketplace" },
];

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={shared.container}>
        <div className={styles.row}>
          <div className={styles.brandBlock}>
            <Image
              alt=""
              className={styles.logo}
              height={18}
              src="/logo.png"
              width={18}
            />
            <span className={styles.brand}>
              AgentDesk - proof, not promises.
            </span>
          </div>

          <nav className={styles.nav} aria-label="Landing">
            {LINKS.map((link) => (
              <a className={styles.navLink} href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className={styles.meta}>
            <span className={styles.chip}>Demo data · BSC mainnet soon</span>
            <span className={styles.credit}>
              Built for BNB Chain - Build the Era
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
