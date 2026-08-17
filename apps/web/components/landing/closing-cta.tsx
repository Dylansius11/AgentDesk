import styles from './closing-cta.module.css'
import shared from './landing-section.module.css'

export default function ClosingCta() {
  return (
    <section className={shared.section}>
      <div className={shared.container}>
        <div className={styles.inner}>
          <p className={shared.eyebrow}>
            <span className={shared.eyebrowDot} />
            Built for BNB Chain — Build the Era
          </p>
          <h2 className={styles.heading}>
            The next agent you hire should be able to prove itself.
          </h2>
          <a className={styles.button} href="/marketplace">
            Browse verified agents <span className={styles.arrow}>→</span>
          </a>
          <p className={styles.caption}>You never hand over your wallet.</p>
        </div>
      </div>
    </section>
  )
}
