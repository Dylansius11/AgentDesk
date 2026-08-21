'use client'

/**
 * apps/web/lib/use-hire-job.ts
 *
 * The batched ERC-8183 buyer flow. One `hire()` call runs the full sequence
 * against the connected wallet (negotiate → createJob → registerJob →
 * setBudget → approve → fund), reporting each tx hash + the on-chain jobId.
 *
 * Honest scope: this drives the real on-chain create→fund (5 txs), which is
 * what "Fund escrow" becomes. True single-tx batching (multicall) is a later
 * optimization — the contract exposes these as separate calls, and
 * `registerJob` lives on a different contract (the router), so it can't be
 * folded into one contract call without a multicall helper.
 *
 * Requires: a connected wallet (the buyer), a real seller's provider address
 * + A2A endpoint, and `$U` + tBNB in the buyer's wallet.
 */
import { useCallback, useState } from 'react'
import {
  ERC8183_ADDRESSES,
  agenticCommerceAbi,
  buildJobDescription,
  erc20Abi,
  evaluatorRouterAbi,
  negotiateWithSeller,
  type NegotiationEnvelope,
} from '@agentdesk/sdk'
import { parseEther, type Address, type Hash } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'

const DISPUTE_WINDOW_SEC = 900
const DEADLINE_SEC = 30 * 60
const EMPTY_OPTS = '0x' as const

export interface HireJobInput {
  provider: Address
  task: string
  budgetU: string
  /** Optional seller A2A endpoint (e.g. "http://127.0.0.1:9000/"). */
  negotiateEndpoint?: string
}

export type HireStatus = 'idle' | 'negotiating' | 'signing' | 'done' | 'error'

export interface HireJobState {
  status: HireStatus
  jobId: bigint | null
  txs: Hash[]
  error: string | null
}

const IDLE: HireJobState = { status: 'idle', jobId: null, txs: [], error: null }

export function useHireJob() {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const [state, setState] = useState<HireJobState>(IDLE)

  const hire = useCallback(
    async (input: HireJobInput) => {
      if (!walletClient || !publicClient) {
        setState({ ...IDLE, status: 'error', error: 'wallet not connected' })
        return
      }

      setState({ status: 'negotiating', jobId: null, txs: [], error: null })

      try {
        // 1. Negotiate (optional) — anchor the seller's signed quote on-chain.
        let description = input.task
        if (input.negotiateEndpoint) {
          const envelope: NegotiationEnvelope = await negotiateWithSeller(
            input.negotiateEndpoint,
            input.task,
          )
          description = buildJobDescription(envelope)
        }

        const budget = parseEther(input.budgetU)
        const expiredAt = BigInt(
          Math.floor(Date.now() / 1000) + DISPUTE_WINDOW_SEC + DEADLINE_SEC,
        )
        const txs: Hash[] = []

        setState({ status: 'signing', jobId: null, txs, error: null })

        // 2. createJob → jobId (read back from jobCounter after mining).
        const createHash = await walletClient.writeContract({
          address: ERC8183_ADDRESSES.commerce,
          abi: agenticCommerceAbi,
          functionName: 'createJob',
          args: [
            input.provider,
            ERC8183_ADDRESSES.router,
            expiredAt,
            description,
            ERC8183_ADDRESSES.router,
          ],
        })
        txs.push(createHash)
        setState({ status: 'signing', jobId: null, txs, error: null })
        await publicClient.waitForTransactionReceipt({ hash: createHash })

        const jobId = await publicClient.readContract({
          address: ERC8183_ADDRESSES.commerce,
          abi: agenticCommerceAbi,
          functionName: 'jobCounter',
        })

        // 3. registerJob (router) — bind the policy.
        const registerHash = await walletClient.writeContract({
          address: ERC8183_ADDRESSES.router,
          abi: evaluatorRouterAbi,
          functionName: 'registerJob',
          args: [jobId, ERC8183_ADDRESSES.policy],
        })
        txs.push(registerHash)
        setState({ status: 'signing', jobId, txs, error: null })
        await publicClient.waitForTransactionReceipt({ hash: registerHash })

        // 4. setBudget (commerce).
        const budgetHash = await walletClient.writeContract({
          address: ERC8183_ADDRESSES.commerce,
          abi: agenticCommerceAbi,
          functionName: 'setBudget',
          args: [jobId, budget, EMPTY_OPTS],
        })
        txs.push(budgetHash)
        setState({ status: 'signing', jobId, txs, error: null })
        await publicClient.waitForTransactionReceipt({ hash: budgetHash })

        // 5. approve $U → fund (commerce pulls the escrow).
        const approveHash = await walletClient.writeContract({
          address: ERC8183_ADDRESSES.usdToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ERC8183_ADDRESSES.commerce, budget],
        })
        txs.push(approveHash)
        setState({ status: 'signing', jobId, txs, error: null })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })

        const fundHash = await walletClient.writeContract({
          address: ERC8183_ADDRESSES.commerce,
          abi: agenticCommerceAbi,
          functionName: 'fund',
          args: [jobId, budget, EMPTY_OPTS],
        })
        txs.push(fundHash)
        setState({ status: 'signing', jobId, txs, error: null })
        await publicClient.waitForTransactionReceipt({ hash: fundHash })

        setState({ status: 'done', jobId, txs, error: null })
      } catch (error) {
        setState({
          status: 'error',
          jobId: state.jobId,
          txs: state.txs,
          error: error instanceof Error ? error.message : 'hire failed',
        })
      }
    },
    [walletClient, publicClient, state.jobId, state.txs],
  )

  return { hire, state }
}
