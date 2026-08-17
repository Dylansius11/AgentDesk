import { redirect } from 'next/navigation'

export default function VerifyIndexPage() {
  // "1001" = GridGoblin, the scripted demo agent (packages/sdk fixtures/agents/grid.ts)
  redirect('/verify/1001')
}
