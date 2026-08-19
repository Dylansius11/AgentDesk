import type { Metadata } from 'next'
import DashboardPage from '@/components/dashboard/dashboard-page'

export const metadata: Metadata = {
  title: 'Dashboard — AgentDesk',
  description: 'Your hired agents, live. Every action pre-registered on-chain.',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ agentId?: string | string[]; jobId?: string | string[] }>
}) {
  const query = await searchParams
  return (
    <DashboardPage
      agentId={typeof query.agentId === 'string' ? query.agentId : undefined}
      jobId={typeof query.jobId === 'string' ? query.jobId : undefined}
    />
  )
}
