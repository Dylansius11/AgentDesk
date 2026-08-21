/**
 * packages/sdk/src/validate.ts
 *
 * `pnpm fixtures:validate` entry point. Validates every fixture against its
 * zod schema and checks the twelve simulated marketplace fixtures (3 per
 * category, exactly 2 unverified) plus the one explicit live execution
 * binding. Fails loudly, with a nonzero exit and every issue printed, on any
 * drift. Run directly with tsx, no build step required.
 */

import { AGENTS, HIRE_SESSIONS } from './fixtures/index.js'
import { AgentSchema } from './schemas/agent.js'
import { CATEGORIES, type Category } from './schemas/category.js'
import { HireSessionSchema } from './schemas/hire-session.js'

let failures = 0

function fail(message: string): void {
  failures += 1
  console.error(`  ✗ ${message}`)
}

function pass(message: string): void {
  console.log(`  ✓ ${message}`)
}

console.log(
  `\n[fixtures:validate] validating ${AGENTS.length} agent fixtures against Agent schema...\n`,
)

for (const agent of AGENTS) {
  const result = AgentSchema.safeParse(agent)
  if (result.success) {
    pass(`${agent.name} (${agent.category}, ${agent.verified ? 'verified' : 'unverified'})`)
  } else {
    fail(`${agent.name ?? '<unnamed agent>'} failed Agent schema validation:`)
    for (const issue of result.error.issues) {
      console.error(`      - [${issue.path.join('.') || '<root>'}] ${issue.message}`)
    }
  }
}

console.log(
  `\n[fixtures:validate] validating ${HIRE_SESSIONS.length} hire-session fixtures against HireSession schema...\n`,
)

for (const session of HIRE_SESSIONS) {
  const result = HireSessionSchema.safeParse(session)
  if (result.success) {
    pass(`${session.id} (${session.status})`)
  } else {
    fail(`${session.id ?? '<unnamed session>'} failed HireSession schema validation:`)
    for (const issue of result.error.issues) {
      console.error(`      - [${issue.path.join('.') || '<root>'}] ${issue.message}`)
    }
  }
}

console.log('\n[fixtures:validate] checking fixture-roster invariants (AGENT-TASKS.md A0.3)...\n')

const simulatedAgents = AGENTS.filter((agent) => agent.execution === undefined)
const liveExecutionAgents = AGENTS.filter((agent) => agent.execution !== undefined)

if (simulatedAgents.length === 12) {
  pass(`exactly 12 simulated agent fixtures (got ${simulatedAgents.length})`)
} else {
  fail(`expected exactly 12 simulated agent fixtures, got ${simulatedAgents.length}`)
}

const countsByCategory: Record<Category, number> = {
  grid: 0,
  rebalance: 0,
  yield: 0,
  health: 0,
}
for (const agent of simulatedAgents) {
  countsByCategory[agent.category] += 1
}
for (const category of CATEGORIES) {
  const count = countsByCategory[category]
  if (count === 3) {
    pass(`category "${category}" has exactly 3 simulated agents`)
  } else {
    fail(`category "${category}" has ${count} simulated agents, expected exactly 3`)
  }
}

const unverified = simulatedAgents.filter((agent) => !agent.verified)
if (unverified.length === 2) {
  pass(`exactly 2 unverified simulated agents (${unverified.map((a) => a.name).join(', ')})`)
} else {
  fail(
    `expected exactly 2 unverified simulated agents, got ${unverified.length}${
      unverified.length ? ` (${unverified.map((a) => a.name).join(', ')})` : ''
    }`,
  )
}

if (liveExecutionAgents.length === 1 && liveExecutionAgents[0]?.execution) {
  pass(`${liveExecutionAgents[0].name} is the sole live execution binding`)
} else {
  fail(`expected exactly one live execution binding, got ${liveExecutionAgents.length}`)
}

// unique agent ids
const ids = new Set<string>()
for (const agent of AGENTS) {
  if (ids.has(agent.id)) {
    fail(`duplicate agent id "${agent.id}"`)
  }
  ids.add(agent.id)
}
if (ids.size === AGENTS.length) {
  pass('all agent ids are unique')
}

// unique proof record ids across the whole roster (recordId is a global ledger sequence, never reused per-agent)
const recordIds = new Set<number>()
let duplicateRecordIds = 0
for (const agent of AGENTS) {
  for (const record of agent.proofRecords) {
    if (recordIds.has(record.recordId)) {
      duplicateRecordIds += 1
      fail(`duplicate proof record id ${record.recordId} (agent ${agent.name})`)
    }
    recordIds.add(record.recordId)
  }
}
if (duplicateRecordIds === 0) {
  pass(`all ${recordIds.size} proof record ids are unique across the roster`)
}

console.log('')
if (failures > 0) {
  console.error(`[fixtures:validate] FAILED - ${failures} issue(s) found.\n`)
  process.exit(1)
} else {
  console.log(
    `[fixtures:validate] PASSED - ${AGENTS.length} agents (${unverified.length} unverified), ${HIRE_SESSIONS.length} hire sessions, ${recordIds.size} proof records, all schema-valid.\n`,
  )
  process.exit(0)
}
