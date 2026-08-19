'use client'

/*
 * apps/web/lib/wallet-provider.tsx
 *
 * React context wrapper that mounts wagmi + react-query for the whole app.
 * Everything downstream (hire flow, navbar, escrow step) reads wallet state
 * through wagmi hooks; this is the single place the providers are wired.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from './web3'

export function WalletProvider({ children }: { children: ReactNode }) {
  // One query client per mount; stable across re-renders.
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
