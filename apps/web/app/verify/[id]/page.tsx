import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VerifyPage from '@/components/verify/verify-page'
import { AGENTS } from '@/lib/mock-agents'

export function generateStaticParams() {
  return AGENTS.map((agent) => ({ id: agent.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const agent = AGENTS.find((entry) => entry.id === id)
  if (!agent) return { title: 'Agent not found — AgentDesk Verify' }
  return {
    title: `Audit ${agent.name} — AgentDesk Verify`,
    description: `Public on-chain verification ledger for ${agent.name}. Recompute return, win rate, and proof records directly from BNB Chain logs.`,
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agent = AGENTS.find((entry) => entry.id === id)
  if (!agent) notFound()
  return <VerifyPage agent={agent} />
}
