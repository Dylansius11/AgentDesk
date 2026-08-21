'use client'

import {
  type AgentExecution,
  agenticCommerceAbi,
  buildJobDescription,
  ERC8183_ADDRESSES,
  erc20Abi,
  evaluatorRouterAbi,
  type NegotiationEnvelope,
  negotiateWithSeller,
} from '@agentdesk/sdk'
/**
 * One guided ERC-8183 buyer flow. The connected buyer confirms five distinct
 * EOA transactions: createJob, registerJob, setBudget, approve, and fund.
 */
import { useCallback, useState } from 'react'
import { type Address, type Hash, parseEther, parseEventLogs } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'

const DISPUTE_WINDOW_SEC = 900
const DEADLINE_SEC = 30 * 60
const EMPTY_OPTS = '0x' as const

export interface HireJobInput {
  execution: AgentExecution
  task: string
  budgetU: string
}

export type HireStatus = 'idle' | 'negotiating' | 'signing' | 'done' | 'error'
export type HireStage = 'negotiate' | 'create' | 'register' | 'budget' | 'approve' | 'fund' | null

export interface HireJobState {
  status: HireStatus
  stage: HireStage
  jobId: bigint | null
  txs: Hash[]
  error: string | null
}

const IDLE: HireJobState = { status: 'idle', stage: null, jobId: null, txs: [], error: null }

export function useHireJob() {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const [state, setState] = useState<HireJobState>(IDLE)

  const hire = useCallback(
    async (input: HireJobInput): Promise<HireJobState> => {
      if (!walletClient || !publicClient || !walletClient.account) {
        const next = { ...IDLE, status: 'error' as const, error: 'wallet not connected' }
        setState(next)
        return next
      }

      const buyer = walletClient.account.address as Address
      const provider = input.execution.providerAddress as Address
      let current: HireJobState = {
        status: 'negotiating',
        stage: 'negotiate',
        jobId: null,
        txs: [],
        error: null,
      }
      const report = (next: HireJobState): HireJobState => {
        current = next
        setState(next)
        return next
      }
      const reportTransaction = (
        stage: Exclude<HireStage, 'negotiate' | null>,
        hash: Hash,
        jobId = current.jobId,
      ) =>
        report({
          status: 'signing',
          stage,
          jobId,
          txs: [...current.txs, hash],
          error: null,
        })
      const waitForSuccess = async (hash: Hash) => {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error(`transaction ${hash} reverted`)
        return receipt
      }

      try {
        const envelope: NegotiationEnvelope = await negotiateWithSeller(
          input.execution.negotiateEndpoint,
          input.task,
        )
        const description = buildJobDescription(envelope)
        const budget = parseEther(input.budgetU)
        const expiredAt = BigInt(Math.floor(Date.now() / 1000) + DISPUTE_WINDOW_SEC + DEADLINE_SEC)

        report({ ...current, status: 'signing', stage: 'create' })
        const createHash = await walletClient.writeContract({
          account: walletClient.account,
          address: ERC8183_ADDRESSES.commerce,
          abi: agenticCommerceAbi,
          functionName: 'createJob',
          args: [
            provider,
            ERC8183_ADDRESSES.router,
            expiredAt,
            description,
            ERC8183_ADDRESSES.router,
          ],
        })
        reportTransaction('create', createHash)
        const createReceipt = await waitForSuccess(createHash)
        const jobCreated = parseEventLogs({
          abi: agenticCommerceAbi,
          eventName: 'JobCreated',
          logs: createReceipt.logs.filter(
            (log) => log.address.toLowerCase() === ERC8183_ADDRESSES.commerce.toLowerCase(),
          ),
        }).find(
          (event) =>
            event.args.client?.toLowerCase() === buyer.toLowerCase() &&
            event.args.provider?.toLowerCase() === provider.toLowerCase(),
        )
        const jobId = jobCreated?.args.jobId
        if (jobId === undefined) {
          throw new Error(
            'createJob receipt did not contain this buyer and provider JobCreated event',
          )
        }

        report({ ...current, stage: 'register', jobId })
        const registerHash = await walletClient.writeContract({
          account: walletClient.account,
          address: ERC8183_ADDRESSES.router,
          abi: evaluatorRouterAbi,
          functionName: 'registerJob',
          args: [jobId, ERC8183_ADDRESSES.policy],
        })
        reportTransaction('register', registerHash, jobId)
        await waitForSuccess(registerHash)

        report({ ...current, stage: 'budget', jobId })
        const budgetHash = await walletClient.writeContract({
          account: walletClient.account,
          address: ERC8183_ADDRESSES.commerce,
          abi: agenticCommerceAbi,
          functionName: 'setBudget',
          args: [jobId, budget, EMPTY_OPTS],
        })
        reportTransaction('budget', budgetHash, jobId)
        await waitForSuccess(budgetHash)

        report({ ...current, stage: 'approve', jobId })
        const approveHash = await walletClient.writeContract({
          account: walletClient.account,
          address: ERC8183_ADDRESSES.usdToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ERC8183_ADDRESSES.commerce, budget],
        })
        reportTransaction('approve', approveHash, jobId)
        await waitForSuccess(approveHash)

        report({ ...current, stage: 'fund', jobId })
        const fundHash = await walletClient.writeContract({
          account: walletClient.account,
          address: ERC8183_ADDRESSES.commerce,
          abi: agenticCommerceAbi,
          functionName: 'fund',
          args: [jobId, budget, EMPTY_OPTS],
        })
        reportTransaction('fund', fundHash, jobId)
        await waitForSuccess(fundHash)

        return report({ ...current, status: 'done', stage: 'fund', jobId, error: null })
      } catch (error) {
        return report({
          ...current,
          status: 'error',
          error: error instanceof Error ? error.message : 'hire failed',
        })
      }
    },
    [publicClient, walletClient],
  )

  return { hire, state }
}
