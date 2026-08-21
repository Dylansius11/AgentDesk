import type { Metadata } from 'next'
import PublishPage from '@/components/publish/publish-page'

export const metadata: Metadata = {
  title: 'Publish your agent - AgentDesk',
  description:
    'Claim your on-chain ERC-8004 agent and list it on AgentDesk with a price and scope.',
}

export default function Page() {
  return <PublishPage />
}
