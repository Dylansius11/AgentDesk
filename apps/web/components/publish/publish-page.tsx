'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import SiteNavbar from '@/components/site-navbar'
import { ConnectWalletButton, shortenAddress } from '@/components/wallet/connect-wallet-button'
import styles from './publish-page.module.css'

const CATEGORIES = [
  { id: 'grid', label: 'Grid Trading' },
  { id: 'rebalance', label: 'Rebalancing' },
  { id: 'yield', label: 'Yield Optimisation' },
  { id: 'health', label: 'Health-Factor Monitoring' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

export default function PublishPage() {
  const { address, isConnected } = useAccount()
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [category, setCategory] = useState<CategoryId>('grid')
  const [price, setPrice] = useState(1)
  const [description, setDescription] = useState('')
  const [signing, setSigning] = useState(false)
  const [published, setPublished] = useState(false)

  const canSubmit =
    isConnected && name.trim().length > 0 && tagline.trim().length > 0 && description.trim().length > 0
  const publish = async () => {
    if (!canSubmit) return
    setSigning(true)
    // Simulated ownership-signature verification + listing upsert (Phase B:
    // POST /v1/publish verifies the ERC-8004 owner signature on-chain).
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 2400)
    await promise
    setSigning(false)
    setPublished(true)
  }

  return (
    <div className={styles.page}>
      <SiteNavbar />

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Publish your agent.</h1>
          <p className={styles.sub}>
            Claim the on-chain agent you own and list it on AgentDesk with a price and scope.
          </p>

          {published ? (
            <div className={styles.success}>
              <span className={styles.successDot} />
              <h2 className={styles.successTitle}>Listing submitted</h2>
              <p className={styles.successBody}>
                <strong>{name}</strong> is pending on-chain verification. Once the owner signature is
                verified against the ERC-8004 registry, it appears on the marketplace.
              </p>
              <p className={styles.txLine}>verification · simulated (Phase B)</p>
              <div className={styles.actions}>
                <Link className={styles.ghostButton} href="/marketplace">
                  Back to marketplace
                </Link>
                <button
                  className={styles.blackPill}
                  onClick={() => {
                    setPublished(false)
                    setName('')
                    setTagline('')
                    setDescription('')
                  }}
                  type="button"
                >
                  Publish another →
                </button>
              </div>
            </div>
          ) : (
            <>
              <section className={styles.section}>
                <span className={styles.stepIndex}>01</span>
                <span className={styles.fieldLabel}>Agent owner wallet</span>
                {isConnected && address ? (
                  <span className={styles.connected}>
                    {shortenAddress(address)}
                    <span className={styles.connectedNote}>· proves you own the agent</span>
                  </span>
                ) : (
                  <ConnectWalletButton className={styles.connect} />
                )}
              </section>

              <section className={styles.section}>
                <span className={styles.stepIndex}>02</span>
                <span className={styles.fieldLabel}>Listing details</span>

                <label className={styles.inputLabel} htmlFor="name">
                  Agent name
                </label>
                <input
                  className={styles.input}
                  id="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. GridGoblin"
                  value={name}
                />

                <label className={styles.inputLabel} htmlFor="tagline">
                  Tagline
                </label>
                <input
                  className={styles.input}
                  id="tagline"
                  maxLength={140}
                  onChange={(event) => setTagline(event.target.value)}
                  placeholder="One sentence about what it does"
                  value={tagline}
                />

                <span className={styles.inputLabel}>Category</span>
                <div className={styles.pillRow}>
                  {CATEGORIES.map((option) => (
                    <button
                      className={`${styles.pill} ${category === option.id ? styles.pillActive : ''}`}
                      key={option.id}
                      onClick={() => setCategory(option.id)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <label className={styles.inputLabel} htmlFor="price">
                  Price per completed task ($U)
                </label>
                <input
                  className={styles.input}
                  id="price"
                  min={0}
                  onChange={(event) => setPrice(Number(event.target.value) || 0)}
                  type="number"
                  value={price}
                />

                <label className={styles.inputLabel} htmlFor="description">
                  Description
                </label>
                <textarea
                  className={styles.textarea}
                  id="description"
                  maxLength={4000}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What a task is, and what completion means"
                  value={description}
                />
              </section>

              <div className={styles.actions}>
                <Link className={styles.ghostButton} href="/marketplace">
                  Cancel
                </Link>
                <button
                  className={styles.blackPill}
                  disabled={!canSubmit || signing}
                  onClick={publish}
                  type="button"
                >
                  {signing ? 'Verifying ownership…' : 'Sign ownership + publish ▸'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
