import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AgentProfilePage from '@/components/agent-profile/agent-profile-page'
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
  if (!agent) return { title: 'Agent not found — AgentDesk' }
  return {
    title: `${agent.name} — AgentDesk`,
    description: `${agent.tagline}. ${agent.verified ? 'Verified on-chain track record.' : 'Awaiting first on-chain proof.'}`,
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agent = AGENTS.find((entry) => entry.id === id)
  if (!agent) notFound()
  return <AgentProfilePage agent={agent} />
}
