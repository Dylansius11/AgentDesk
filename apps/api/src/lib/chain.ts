/**
 * apps/api/src/lib/chain.ts
 *
 * Shared viem clients for talking to the real ProofLedger deployment from
 * the API process. Mirrors apps/keeper/src/lib/chain.ts's pattern exactly
 * (chain id resolved lazily via eth_chainId rather than hardcoded, so the
 * same code works against anvil/Chapel/mainnet) — kept as a SEPARATE file
 * rather than shared, per ARCHITECTURE.md §3's "apps never import each
 * other" rule.
 *
 * services/session-enforcement.ts is the ONLY caller of getWalletClient()
 * here — it signs with DEMO_AGENT_PRIVATE_KEY (apps/api/.env.demo-agent),
 * NOT KEEPER_ATTESTER_KEY. The demo-agent key only ever calls
 * ProofLedger.registerDecision (no ATTESTER_ROLE needed — see
 * SMART-CONTRACT.md: registerDecision has no access control).
 *
 * DEMO_AGENT_PRIVATE_KEY is read here only to derive the signing account —
 * never logged, never returned from any exported function (CLAUDE.md §4).
 */
import { proofLedgerAbi } from '@agentdesk/sdk'
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { env } from '../env.js'

export { proofLedgerAbi }

const RPC_URL = env.BSC_TESTNET_RPC_URL ?? env.BSC_RPC_URL

const PROOFLEDGER_ADDRESS = (env.PROOFLEDGER_ADDRESS_TESTNET ?? env.PROOFLEDGER_ADDRESS_MAINNET) as
  | Address
  | undefined

let chainPromise: Promise<Chain> | null = null

/** Resolves (and caches) a viem Chain object matching whatever network RPC_URL actually points at. */
async function resolveChain(): Promise<Chain> {
  if (!RPC_URL) throw new Error('chain: BSC_TESTNET_RPC_URL / BSC_RPC_URL not configured')
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

/** Read-only client — used to read back registered decisions (getDecision) after a submit. */
export async function getPublicClient(): Promise<PublicClient> {
  if (!RPC_URL) throw new Error('chain: BSC_TESTNET_RPC_URL / BSC_RPC_URL not configured')
  if (!publicClientPromise) {
    publicClientPromise = resolveChain().then((chain) =>
      createPublicClient({ chain, transport: http(RPC_URL) }),
    )
  }
  return publicClientPromise
}

/**
 * Signing client for registerDecision — the ONLY thing
 * DEMO_AGENT_PRIVATE_KEY is used for. registerDecision has no access
 * control on-chain (SMART-CONTRACT.md), so this key needs no on-chain role
 * grant, unlike KEEPER_ATTESTER_KEY.
 */
export async function getDemoAgentWalletClient(): Promise<WalletClient> {
  if (!RPC_URL) throw new Error('chain: BSC_TESTNET_RPC_URL / BSC_RPC_URL not configured')
  if (!env.DEMO_AGENT_PRIVATE_KEY) {
    throw new Error('chain: DEMO_AGENT_PRIVATE_KEY not configured (apps/api/.env.demo-agent)')
  }
  const chain = await resolveChain()
  const privateKey = env.DEMO_AGENT_PRIVATE_KEY as `0x${string}`
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({ chain, account, transport: http(RPC_URL) })
}

export function getProofLedgerAddress(): Address {
  if (!PROOFLEDGER_ADDRESS) {
    throw new Error(
      'chain: PROOFLEDGER_ADDRESS_TESTNET / PROOFLEDGER_ADDRESS_MAINNET not configured',
    )
  }
  return PROOFLEDGER_ADDRESS
}
