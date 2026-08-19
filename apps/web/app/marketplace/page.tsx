import type { Category } from '@agentdesk/sdk'
import type { Metadata } from 'next'
import MarketplacePage from '@/components/marketplace/marketplace-page'

export const metadata: Metadata = {
  title: 'Marketplace — AgentDesk',
  description:
    'Browse verified trading agents on BNB Chain. Every track record computed from on-chain proof.',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>
}) {
  const requested = (await searchParams).category
  const category =
    typeof requested === 'string' &&
    (['grid', 'rebalance', 'yield', 'health'] as const).includes(requested as Category)
      ? (requested as Category)
      : 'all'
  return <MarketplacePage initialCategory={category} />
}
