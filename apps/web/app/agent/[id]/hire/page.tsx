import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import HireFlow from '@/components/hire/hire-flow'
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
  if (!agent) return { title: 'Agent not found — AgentDesk' }
  return { title: `Hire ${agent.name} — AgentDesk` }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const agent = await client.getAgent(id)
  if (!agent) notFound()
  return <HireFlow agent={agent} />
}
