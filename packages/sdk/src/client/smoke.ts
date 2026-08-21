/**
 * packages/sdk/src/client/smoke.ts
 *
 * Not a unit test suite — a runnable proof-of-life for `AgentDeskClient`
 * (task: "Mock AgentDeskClient", Wave 2, AGENT-TASKS.md) that a human can
 * read top to bottom: getAgents/getAgent/getProofRecords return real fixture
 * data with visible latency, hire() produces a schema-valid session,
 * getDashboard() ticks scripted events, and revoke() stops the feed. Run
 * with `pnpm --filter @agentdesk/sdk exec tsx src/client/smoke.ts` (short
 * mode; ~6s) or pass `--full` for one real 5s tick pair before revoking
 * (~11s). Exits non-zero on any assertion failure.
 */
import { FixturesAgentDeskClient } from './fixtures-client.js'
import type { DashboardEvent } from './types.js'

const FULL = process.argv.includes('--full')
let failures = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`)
  } else {
    failures += 1
    console.error(`  ✗ ${message}`)
  }
}

async function main(): Promise<void> {
  const client = new FixturesAgentDeskClient()

  console.log('\n[smoke] getAgents() - no filter')
  const t0 = Date.now()
  const all = await client.getAgents()
  const elapsed0 = Date.now() - t0
  assert(
    all.length === 13,
    `getAgents() returns 12 simulated fixtures plus one canary (got ${all.length})`,
  )
  assert(elapsed0 >= 100, `getAgents() took visible latency (${elapsed0}ms, expected >=~150ms)`)
  assert(
    all.some((a) => a.name === 'HealthGuard'),
    'HealthGuard (the demo-script agent) is present',
  )
  const liveExecutionAgents = all.filter((agent) => agent.execution !== undefined)
  assert(
    liveExecutionAgents.length === 1 &&
      liveExecutionAgents[0]?.name === 'ERC-8183 Canary' &&
      liveExecutionAgents[0].execution?.negotiateEndpoint === 'http://127.0.0.1:9000/erc8183',
    'only the ERC-8183 Canary selects the local live seller binding',
  )

  console.log('\n[smoke] getAgents() - filtered + sorted')
  const healthVerified = await client.getAgents({
    category: 'health',
    verified: true,
    sort: 'verifiedReturn',
  })
  assert(
    healthVerified.every((a) => a.category === 'health' && a.verified),
    `category+verified filter honored (${healthVerified.length} results, all health+verified)`,
  )
  for (let i = 1; i < healthVerified.length; i++) {
    const prev = healthVerified[i - 1]?.metrics?.verifiedReturnPct ?? Number.NEGATIVE_INFINITY
    const cur = healthVerified[i]?.metrics?.verifiedReturnPct ?? Number.NEGATIVE_INFINITY
    assert(prev >= cur, `sort=verifiedReturn is descending at index ${i}`)
  }

  console.log('\n[smoke] getAgent()')
  const healthGuard = await client.getAgent('4001')
  assert(
    healthGuard !== null && healthGuard.name === 'HealthGuard',
    "getAgent('4001') returns HealthGuard",
  )
  const missing = await client.getAgent('999999999')
  assert(missing === null, 'getAgent() on an unknown id returns null (not a throw)')

  console.log('\n[smoke] getProofRecords()')
  const records = await client.getProofRecords('4001')
  assert(records.length > 0, `getProofRecords('4001') returns ${records.length} real proof records`)
  const resolvedOnly = await client.getProofRecords('4001', { status: 'resolved' })
  assert(
    resolvedOnly.every((r) => r.outcome !== null),
    "status='resolved' filter excludes pending records",
  )

  console.log('\n[smoke] hire()')
  const session = await client.hire({
    agentId: '4001',
    hirerAddress: '0x1234567890123456789012345678901234567890',
    config: {
      amountUsd1: 200,
      spendCapUsd1: 50,
      spendCapWindow: 'day',
      durationDays: 7,
      allowlist: [
        {
          protocol: 'Venus',
          action: 'adjust-collateral',
          market: 'Venus BNB collateral',
          label: 'smoke-test grant',
        },
      ],
    },
  })
  assert(session.status === 'active', 'hire() returns an active session')
  assert(session.session.keystoreTx.startsWith('0x'), 'hire() session carries a keystoreTx')
  assert(
    session.feeUsd1 === 6,
    `hire() computes the 3% protocol fee correctly (got ${session.feeUsd1}, expected 6)`,
  )

  console.log(`\n[smoke] getDashboard() - ${FULL ? 'full (~11s)' : 'short (~1s)'} mode`)
  const seen: DashboardEvent['type'][] = []
  const stream = client.getDashboard(session.id)
  const first = await stream.next()
  assert(!first.done && first.value.type === 'connected', "getDashboard() yields 'connected' first")
  if (first.value) seen.push(first.value.type)

  if (FULL) {
    // Let two real ~5s ticks play out, then revoke mid-flight and confirm the feed reacts fast.
    const collector = (async () => {
      for (let i = 0; i < 4; i++) {
        const next = await stream.next()
        if (next.done) break
        seen.push(next.value.type)
        if (next.value.type === 'session_revoked') break
      }
    })()
    await new Promise((resolve) => setTimeout(resolve, 6500))
    const revokeStart = Date.now()
    await client.revoke(session.id)
    await collector
    const revokeElapsed = Date.now() - revokeStart
    assert(
      seen.includes('session_revoked'),
      `feed observed session_revoked (events seen: ${seen.join(', ')})`,
    )
    assert(
      revokeElapsed < 5000,
      `feed reacted to revoke() well inside the next 5s tick (${revokeElapsed}ms)`,
    )
  } else {
    await client.revoke(session.id)
    const next = await stream.next()
    assert(
      !next.done && next.value.type === 'session_revoked',
      'getDashboard() reacts to revoke() and yields session_revoked',
    )
    const after = await stream.next()
    assert(after.done === true, 'getDashboard() generator ends after session_revoked')
  }

  const revoked = await client.revoke(session.id)
  assert(revoked.status === 'revoked', 'revoke() is idempotent on an already-revoked job')

  console.log('')
  if (failures > 0) {
    console.error(`[smoke] FAILED - ${failures} assertion(s) failed.\n`)
    process.exit(1)
  }
  console.log(
    '[smoke] PASSED - AgentDeskClient (fixtures) round-trips real fixture data end to end.\n',
  )
}

main().catch((err) => {
  console.error('[smoke] threw:', err)
  process.exit(1)
})
