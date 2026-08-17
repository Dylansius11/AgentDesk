import type { Metadata } from 'next'
import shared from '@/components/landing/landing-section.module.css'
import SiteFooter from '@/components/landing/site-footer'
import SiteNavbar from '@/components/site-navbar'
import styles from './style-page.module.css'

export const metadata: Metadata = {
  title: 'AgentDesk — Design tokens',
  description: 'The palette, type scale, and spacing system every AgentDesk screen is built from.',
}

const CANVAS_SWATCHES = [
  { name: 'Canvas', varName: '--color-bg-canvas' },
  { name: 'Surface', varName: '--color-bg-surface' },
  { name: 'Surface raised', varName: '--color-bg-surface-raised' },
  { name: 'Surface hover', varName: '--color-bg-surface-hover' },
]

const BORDER_SWATCHES = [
  { name: 'Border subtle', varName: '--color-border-subtle' },
  { name: 'Border default', varName: '--color-border-default' },
  { name: 'Border strong', varName: '--color-border-strong' },
]

const TEXT_SWATCHES = [
  { name: 'Text primary', varName: '--color-text-primary' },
  { name: 'Text secondary', varName: '--color-text-secondary' },
  { name: 'Text tertiary', varName: '--color-text-tertiary' },
]

const GOLD_SWATCHES = [
  { name: 'Gold — accent', varName: '--color-accent-gold' },
  { name: 'Gold — hover', varName: '--color-accent-gold-hover' },
  { name: 'Gold — soft fill', varName: '--color-accent-gold-soft' },
  { name: 'Gold — border', varName: '--color-accent-gold-border' },
]

const MONEY_SWATCHES = [
  { name: 'Positive', varName: '--color-money-positive' },
  { name: 'Positive soft', varName: '--color-money-positive-soft' },
  { name: 'Negative', varName: '--color-money-negative' },
  { name: 'Negative soft', varName: '--color-money-negative-soft' },
]

const SPACING = [1, 2, 3, 4, 5, 6, 7, 8]
const RADII = ['sm', 'md', 'lg', 'xl', 'full']

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className={styles.swatch}>
      <div className={styles.swatchFill} style={{ background: `var(${varName})` }} />
      <div className={styles.swatchMeta}>
        <span className={styles.swatchName}>{name}</span>
        <span className={styles.swatchVar}>{varName}</span>
      </div>
    </div>
  )
}

export default function StylePage() {
  return (
    <div className={styles.page}>
      <SiteNavbar />
      <main className={shared.section}>
        <div className={shared.container}>
          <p className={shared.eyebrow}>
            <span className={shared.eyebrowDot} />
            Design system
          </p>
          <h1 className={shared.heading}>Tokens.</h1>
          <p className={styles.intro}>
            Every color, radius, shadow, and font weight AgentDesk renders resolves to one of the
            custom properties below (defined in <code>app/globals.css</code>). No component hardcodes a raw
            hex value — this page doubles as the QA tool that proves it.
          </p>

          {/* ---------- palette ---------- */}

          <section style={{ marginTop: 56 }}>
            <h2 className={styles.sectionHeading}>Canvas &amp; surfaces</h2>
            <div className={styles.swatchGrid}>
              {CANVAS_SWATCHES.map((s) => (
                <Swatch key={s.varName} {...s} />
              ))}
            </div>
          </section>

          <section style={{ marginTop: 40 }}>
            <h2 className={styles.sectionHeading}>Borders</h2>
            <div className={styles.swatchGrid}>
              {BORDER_SWATCHES.map((s) => (
                <Swatch key={s.varName} {...s} />
              ))}
            </div>
          </section>

          <section style={{ marginTop: 40 }}>
            <h2 className={styles.sectionHeading}>Text</h2>
            <div className={styles.swatchGrid}>
              {TEXT_SWATCHES.map((s) => (
                <Swatch key={s.varName} {...s} />
              ))}
            </div>
          </section>

          <section style={{ marginTop: 40 }}>
            <h2 className={styles.sectionHeading}>BNB gold</h2>
            <p className={styles.sectionNote}>
              Reserved for verification badges and primary actions only — never decoration.
            </p>
            <div className={styles.swatchGrid}>
              {GOLD_SWATCHES.map((s) => (
                <Swatch key={s.varName} {...s} />
              ))}
            </div>
          </section>

          <section style={{ marginTop: 40 }}>
            <h2 className={styles.sectionHeading}>Money semantics</h2>
            <p className={styles.sectionNote}>Green for gains, red for losses. Never used for anything else.</p>
            <div className={styles.swatchGrid}>
              {MONEY_SWATCHES.map((s) => (
                <Swatch key={s.varName} {...s} />
              ))}
            </div>
          </section>

          {/* ---------- type specimen ---------- */}

          <section style={{ marginTop: 56 }}>
            <h2 className={styles.sectionHeading}>Type</h2>
            <div className={styles.typeBlock}>
              <div className={styles.typeRow}>
                <span className={styles.typeLabel}>Heading 1 — Inter 300, clamp(1.9rem, 4vw, 3rem)</span>
                <p className={styles.typeSampleHeading1}>Proof, not promises.</p>
              </div>
              <div className={styles.typeRow}>
                <span className={styles.typeLabel}>Heading 2 — Inter 500, 1.5rem</span>
                <p className={styles.typeSampleHeading2}>Every trade, pre-registered on-chain.</p>
              </div>
              <div className={styles.typeRow}>
                <span className={styles.typeLabel}>Body — Inter 400, 15px</span>
                <p className={styles.typeSampleBody}>
                  Hire a trading agent whose track record you can verify yourself, not one anyone
                  merely claims is good.
                </p>
              </div>
              <div className={styles.typeRow}>
                <span className={styles.typeLabel}>Secondary — Inter 400, 13px</span>
                <p className={styles.typeSampleSecondary}>pre-registered 14:02:11 · attested on-chain</p>
              </div>
              <div className={styles.typeRow}>
                <span className={styles.typeLabel}>Mono tabular — every number, always</span>
                <p className={styles.typeSampleMono}>
                  $12,480.55&nbsp;&nbsp;
                  <span className={styles.moneyPositive}>+2.14%</span>
                  &nbsp;&nbsp;
                  <span className={styles.moneyNegative}>-0.86%</span>
                </p>
              </div>
            </div>
          </section>

          {/* ---------- spacing ---------- */}

          <section style={{ marginTop: 56 }}>
            <h2 className={styles.sectionHeading}>Spacing (4px base)</h2>
            <div className={styles.scaleList}>
              {SPACING.map((n) => (
                <div className={styles.scaleRow} key={n}>
                  <span className={styles.scaleLabel}>--space-{n}</span>
                  <div className={styles.scaleBar} style={{ width: `var(--space-${n})` }} />
                </div>
              ))}
            </div>
          </section>

          {/* ---------- radius ---------- */}

          <section style={{ marginTop: 56 }}>
            <h2 className={styles.sectionHeading}>Radius</h2>
            <div className={styles.scaleList}>
              {RADII.map((r) => (
                <div className={styles.scaleRow} key={r}>
                  <span className={styles.scaleLabel}>--radius-{r}</span>
                  <div className={styles.radiusBox} style={{ borderRadius: `var(--radius-${r})` }} />
                </div>
              ))}
            </div>
          </section>

          {/* ---------- elevation ---------- */}

          <section style={{ marginTop: 56 }}>
            <h2 className={styles.sectionHeading}>Elevation</h2>
            <div className={styles.elevationGrid}>
              <div className={`${styles.elevationCard} ${styles.elevation1}`}>--shadow-1</div>
              <div className={`${styles.elevationCard} ${styles.elevation2}`}>--shadow-2</div>
              <div className={`${styles.elevationCard} ${styles.elevation3}`}>--shadow-3</div>
              <div className={`${styles.elevationCard} ${styles.elevationGold}`}>--shadow-gold-glow</div>
            </div>
          </section>

          {/* ---------- components ---------- */}

          <section style={{ marginTop: 56, marginBottom: 24 }}>
            <h2 className={styles.sectionHeading}>Components</h2>
            <div className={styles.componentRow}>
              <span className={styles.verifiedBadge}>✓ Verified</span>
              <button className={styles.primaryButton} type="button">
                Hire this agent
              </button>
              <button className={styles.stopButtonSample} type="button">
                STOP
              </button>
              <span className={styles.deltaPositive}>+$1.20</span>
              <span className={styles.deltaNegative}>-$0.40</span>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
