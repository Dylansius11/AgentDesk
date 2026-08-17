import type { Metadata } from 'next'
import MarketplacePage from '@/components/marketplace/marketplace-page'

export const metadata: Metadata = {
  title: 'Marketplace — AgentDesk',
  description:
    'Browse verified trading agents on BNB Chain. Every track record computed from on-chain proof.',
}

export default function Page() {
  return <MarketplacePage />
}
