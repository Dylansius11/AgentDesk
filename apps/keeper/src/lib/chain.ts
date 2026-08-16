/**
 * apps/keeper/src/lib/chain.ts
 *
 * Shared viem clients for talking to a real ProofLedger deployment —
 * jobs/indexer.ts and jobs/attester.ts are the only callers (ARCHITECTURE.md
 * §4.3's "the ONLY place that should ever call ProofLedger.attestOutcome").
 *
 * Chain id is resolved lazily via eth_chainId rather than hardcoded to
 * viem/chains' `bsc`/`bscTestnet` presets, so the exact same code path works
 * against local anvil (chainId 31337, Wave 4's local smoke test), Chapel
 * (97), and mainnet (56) without a network-specific branch — this is filling
 * in real logic per the existing job structure, not redesigning it.
 *
 * KEEPER_ATTESTER_KEY is read here (via env.ts) only to derive the signing
 * account — never logged, never returned from any exported function
 * (CLAUDE.md §4 / logger.ts's redaction list).
 */
import {
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { proofLedgerAbi } from '@agentdesk/sdk'
import { env, keeperConfigured } from '../env.js'

export { proofLedgerAbi }

const RPC_URL = env.BSC_RPC_URL ?? env.BSC_TESTNET_RPC_URL

const PROOFLEDGER_ADDRESS = (env.PROOFLEDGER_ADDRESS_MAINNET ?? env.PROOFLEDGER_ADDRESS_TESTNET) as
  | Address
  | undefined

let chainPromise: Promise<Chain> | null = null

/** Resolves (and caches) a viem Chain object matching whatever network RPC_URL actually points at. */
async function resolveChain(): Promise<Chain> {
  if (!RPC_URL) throw new Error('chain: BSC_RPC_URL / BSC_TESTNET_RPC_URL not configured')
  if (!chainPromise) {
    chainPromise = (async () => {
      const bootstrap = createPublicClient({ transport: http(RPC_URL) })
      const id = await bootstrap.getChainId()
      return defineChain({
        id,
        name: `bsc-chain-${id}`,
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        rpcUrls: { default: { http: [RPC_URL] } },
      })
    })()
  }
  return chainPromise
}

let publicClientPromise: Promise<PublicClient> | null = null

/** Read-only client — used by both indexer (event scans) and attester (objective-source reads). */
export async function getPublicClient(): Promise<PublicClient> {
  if (!keeperConfigured.chainRpc) {
    throw new Error('chain: BSC_RPC_URL / BSC_TESTNET_RPC_URL not configured')
  }
  if (!publicClientPromise) {
    publicClientPromise = resolveChain().then((chain) =>
      createPublicClient({ chain, transport: http(RPC_URL) }),
    )
  }
  return publicClientPromise
}

/** Signing client for attestOutcome — the ONLY thing KEEPER_ATTESTER_KEY is used for. */
export async function getWalletClient(): Promise<WalletClient> {
  if (!keeperConfigured.chainRpc) {
    throw new Error('chain: BSC_RPC_URL / BSC_TESTNET_RPC_URL not configured')
  }
  if (!keeperConfigured.attester) {
    throw new Error('chain: KEEPER_ATTESTER_KEY not configured')
  }
  const chain = await resolveChain()
  const privateKey = env.KEEPER_ATTESTER_KEY as `0x${string}`
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({ chain, account, transport: http(RPC_URL) })
}

export function getProofLedgerAddress(): Address {
  if (!PROOFLEDGER_ADDRESS) {
    throw new Error('chain: PROOFLEDGER_ADDRESS_MAINNET / PROOFLEDGER_ADDRESS_TESTNET not configured')
  }
  return PROOFLEDGER_ADDRESS
}
