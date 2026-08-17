import type { Metadata } from 'next'
import DashboardPage from '@/components/dashboard/dashboard-page'

export const metadata: Metadata = {
  title: 'Dashboard — AgentDesk',
  description: 'Your hired agents, live. Every action pre-registered on-chain.',
}

export default function Page() {
  return <DashboardPage />
}
