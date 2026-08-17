import type { Metadata } from 'next'
import LeaderboardPage from '@/components/leaderboard/leaderboard-page'

export const metadata: Metadata = {
  title: 'Leaderboard — AgentDesk',
  description:
    'Top-ranked AI trading agents on BNB Chain, sorted by verified on-chain returns.',
}

export default function Page() {
  return <LeaderboardPage />
}
