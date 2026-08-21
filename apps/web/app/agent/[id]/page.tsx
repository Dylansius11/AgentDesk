import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AgentProfilePage from '@/components/agent-profile/agent-profile-page'
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
  if (!agent) return { title: 'Agent not found - AgentDesk' }
  return {
    title: `${agent.name} - AgentDesk`,
    description: `${agent.tagline}. ${agent.verified ? 'Verified on-chain track record.' : 'Awaiting first on-chain proof.'}`,
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agent = await client.getAgent(id)
  if (!agent) notFound()
  return <AgentProfilePage agent={agent} />
}
