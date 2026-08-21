/**
 * apps/api/src/services/faucet.ts
 *
 * Testnet token faucet: drips $U + tBNB from a dedicated funded EOA to a
 * hirer's address so they can fund escrow without holding test tokens first.
 *
 * Rate limiting is per-address (24h cooldown) + a fixed drip amount, so the
 * faucet wallet can't be drained by one address looping. In-memory store is
 * demo-grade (resets on restart); a production faucet would persist claims in
 * Postgres and add a wallet-balance floor.
 */
import { ERC8183_ADDRESSES, erc20Abi } from '@agentdesk/sdk'
import {
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hash,
} from 'viem'
import { bscTestnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { env } from '../env.js'

/** Amounts per drip — small on purpose (testnet). */
const DRIP_USD = '1'
const DRIP_BNB = '0.05'
const COOLDOWN_MS = 24 * 60 * 60 * 1000

const lastDripAt = new Map<string, number>()

export interface FaucetDrip {
  usdTx: Hash
  bnbTx: Hash
  usdAmount: string
  bnbAmount: string
}

export function cooldownRemainingMs(address: string): number {
  const last = lastDripAt.get(address.toLowerCase()) ?? 0
  const remaining = COOLDOWN_MS - (Date.now() - last)
  return remaining > 0 ? remaining : 0
}

export async function drip(to: Address): Promise<FaucetDrip> {
  const key = env.FAUCET_PRIVATE_KEY
  if (!key) throw new Error('faucet not configured')
  const rpc = env.BSC_TESTNET_RPC_URL ?? env.BSC_RPC_URL
  if (!rpc) throw new Error('BSC RPC not configured')

  const remaining = cooldownRemainingMs(to)
  if (remaining > 0) {
    const hours = Math.max(1, Math.ceil(remaining / 3_600_000))
    throw new Error(`already claimed — try again in ~${hours}h`)
  }

  const account = privateKeyToAccount(key as `0x${string}`)
  const walletClient = createWalletClient({
    chain: bscTestnet,
    transport: http(rpc),
    account,
  })

  const usdTx = await walletClient.writeContract({
    address: ERC8183_ADDRESSES.usdToken,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, parseEther(DRIP_USD)],
  })

  const bnbTx = await walletClient.sendTransaction({
    to,
    value: parseEther(DRIP_BNB),
  })

  lastDripAt.set(to.toLowerCase(), Date.now())
  return { usdTx, bnbTx, usdAmount: DRIP_USD, bnbAmount: DRIP_BNB }
}
