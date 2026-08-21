/*
 * apps/web/lib/web3.ts
 *
 * wagmi config for the BNB Smart Chain (Testnet) wallet-connect seam. Phase B
 * wires the hire flow's "Connect wallet" step to a real EIP-1193 wallet via
 * the `injected` connector (MetaMask + any browser wallet). Chain reads/writes
 * for the ERC-8183 escrow step will reuse this same config.
 */
import { createConfig, http } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const WALLET_CHAIN_ID = bscTestnet.id

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  connectors: [injected()],
  transports: {
    [bscTestnet.id]: http(),
  },
  // SSR-safe: never read `window.ethereum` on the server render.
  ssr: true,
})
