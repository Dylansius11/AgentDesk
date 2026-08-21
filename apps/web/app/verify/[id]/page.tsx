import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VerifyPage from '@/components/verify/verify-page'
import { client } from '@/lib/agentdesk-client'

export async function generateStaticParams() {
  const agents = await client.getAgents()
  return agents.map((agent) => ({ id: agent.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const agent = await client.getAgent(id)
  if (!agent) return { title: 'Agent not found - AgentDesk Verify' }
  return {
    title: `Audit ${agent.name} - AgentDesk Verify`,
    description: `Public on-chain verification ledger for ${agent.name}. Recompute return, win rate, and proof records directly from BNB Chain logs.`,
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agent = await client.getAgent(id)
  if (!agent) notFound()
  return <VerifyPage agent={agent} />
}
