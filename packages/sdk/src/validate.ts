/**
 * packages/sdk/src/validate.ts
 *
 * `pnpm fixtures:validate` entry point. Validates every fixture against its
 * zod schema AND the fixture-roster invariants this task promised (12
 * agents, 3 per category, exactly 2 unverified). Fails loudly — nonzero
 * exit, every issue printed — on any drift. Run directly with tsx, no build
 * step required.
 */
import { AgentSchema } from "./schemas/agent";
import { HireSessionSchema } from "./schemas/hire-session";
import { CATEGORIES, type Category } from "./schemas/category";
import { AGENTS, HIRE_SESSIONS } from "./fixtures/index";

let failures = 0;

function fail(message: string): void {
  failures += 1;
  console.error(`  ✗ ${message}`);
}

function pass(message: string): void {
  console.log(`  ✓ ${message}`);
}

console.log(`\n[fixtures:validate] validating ${AGENTS.length} agent fixtures against Agent schema...\n`);

for (const agent of AGENTS) {
  const result = AgentSchema.safeParse(agent);
  if (result.success) {
    pass(`${agent.name} (${agent.category}, ${agent.verified ? "verified" : "unverified"})`);
  } else {
    fail(`${agent.name ?? "<unnamed agent>"} failed Agent schema validation:`);
    for (const issue of result.error.issues) {
      console.error(`      - [${issue.path.join(".") || "<root>"}] ${issue.message}`);
    }
  }
}

console.log(`\n[fixtures:validate] validating ${HIRE_SESSIONS.length} hire-session fixtures against HireSession schema...\n`);

for (const session of HIRE_SESSIONS) {
  const result = HireSessionSchema.safeParse(session);
  if (result.success) {
    pass(`${session.id} (${session.status})`);
  } else {
    fail(`${session.id ?? "<unnamed session>"} failed HireSession schema validation:`);
    for (const issue of result.error.issues) {
      console.error(`      - [${issue.path.join(".") || "<root>"}] ${issue.message}`);
    }
  }
}

console.log("\n[fixtures:validate] checking fixture-roster invariants (AGENT-TASKS.md A0.3)...\n");

// exactly 12 agents total
if (AGENTS.length === 12) {
  pass(`exactly 12 agent fixtures (got ${AGENTS.length})`);
} else {
  fail(`expected exactly 12 agent fixtures, got ${AGENTS.length}`);
}

// exactly 3 per category
const countsByCategory = new Map<Category, number>(CATEGORIES.map((category) => [category, 0]));
for (const agent of AGENTS) {
  countsByCategory.set(agent.category, (countsByCategory.get(agent.category) ?? 0) + 1);
}
for (const category of CATEGORIES) {
  const count = countsByCategory.get(category) ?? 0;
  if (count === 3) {
    pass(`category "${category}" has exactly 3 agents`);
  } else {
    fail(`category "${category}" has ${count} agents, expected exactly 3`);
  }
}

// exactly 2 unverified across the whole roster
const unverified = AGENTS.filter((agent) => !agent.verified);
if (unverified.length === 2) {
  pass(`exactly 2 unverified agents (${unverified.map((a) => a.name).join(", ")})`);
} else {
  fail(
    `expected exactly 2 unverified agents, got ${unverified.length}${
      unverified.length ? ` (${unverified.map((a) => a.name).join(", ")})` : ""
    }`,
  );
}

// unique agent ids
const ids = new Set<string>();
for (const agent of AGENTS) {
  if (ids.has(agent.id)) {
    fail(`duplicate agent id "${agent.id}"`);
  }
  ids.add(agent.id);
}
if (ids.size === AGENTS.length) {
  pass("all agent ids are unique");
}

// unique proof record ids across the whole roster (recordId is a global ledger sequence, never reused per-agent)
const recordIds = new Set<number>();
let duplicateRecordIds = 0;
for (const agent of AGENTS) {
  for (const record of agent.proofRecords) {
    if (recordIds.has(record.recordId)) {
      duplicateRecordIds += 1;
      fail(`duplicate proof record id ${record.recordId} (agent ${agent.name})`);
    }
    recordIds.add(record.recordId);
  }
}
if (duplicateRecordIds === 0) {
  pass(`all ${recordIds.size} proof record ids are unique across the roster`);
}

console.log("");
if (failures > 0) {
  console.error(`[fixtures:validate] FAILED — ${failures} issue(s) found.\n`);
  process.exit(1);
} else {
  console.log(
    `[fixtures:validate] PASSED — ${AGENTS.length} agents (${unverified.length} unverified), ${HIRE_SESSIONS.length} hire sessions, ${recordIds.size} proof records, all schema-valid.\n`,
  );
  process.exit(0);
}
