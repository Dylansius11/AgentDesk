'use client'

/*
 * apps/web/components/wallet/connect-wallet-button.tsx
 *
 * Minimal, design-neutral connect/disconnect control. Renders a connect action
 * when no wallet is present and a truncated address (tap to disconnect) once
 * connected. Consumers (hire flow, navbar) read the live address through
 * `useAccount` themselves — this button only owns the connect/disconnect call.
 */
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function ConnectWalletButton({ className }: { className?: string }) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const injected = connectors.find((c) => c.type === 'injected' || c.id === 'injected') ?? connectors[0]

  if (isConnected && address) {
    return (
      <button
        aria-label={`Disconnect wallet ${address}`}
        className={className}
        onClick={() => disconnect()}
        title={`Disconnect ${address}`}
        type="button"
      >
        {shortenAddress(address)}
      </button>
    )
  }

  return (
    <button
      className={className}
      disabled={isPending || !injected}
      onClick={() => {
        if (injected) connect({ connector: injected })
      }}
      type="button"
    >
      {isPending ? 'Connecting…' : 'Connect wallet'}
    </button>
  )
}
