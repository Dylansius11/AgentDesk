import assert from 'node:assert/strict'
import test from 'node:test'
import { env } from '../src/env.js'
import { listAgents } from '../src/services/scan8004.js'

const originalFetch = globalThis.fetch
const originalBaseUrl = env.SCAN8004_BASE_URL
const originalApiKey = env.SCAN8004_API_KEY

const agent = {
  id: 'agent-row',
  agent_id: '97:0xregistry:1862',
  token_id: '1862',
  chain_id: 97,
  contract_address: '0xregistry',
  owner_address: '0xowner',
  name: 'Test agent',
  description: null,
}

function listResponse(): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data: [agent],
      meta: {
        version: '1',
        timestamp: '2026-08-19T00:00:00.000Z',
        requestId: 'test-request',
        pagination: { page: 1, limit: 20, total: 1, hasMore: false },
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

test.after(() => {
  globalThis.fetch = originalFetch
  env.SCAN8004_BASE_URL = originalBaseUrl
  env.SCAN8004_API_KEY = originalApiKey
})

test('fetches the public list anonymously with documented page semantics', async () => {
  env.SCAN8004_BASE_URL = 'https://8004scan.io/api/v1/public'
  env.SCAN8004_API_KEY = undefined
  let request: { url: string; headers: Headers } | undefined
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), headers: new Headers(init?.headers) }
    return listResponse()
  }

  const result = await listAgents({ cursor: '2', limit: 1, category: 'grid', verified: true })

  assert.equal(result.stale, false)
  assert.equal(result.data.length, 1)
  assert.ok(request)
  const url = new URL(request.url)
  assert.equal(url.href.split('?')[0], 'https://8004scan.io/api/v1/public/agents')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(url.searchParams.get('limit'), '1')
  assert.equal(url.searchParams.has('offset'), false)
  assert.equal(url.searchParams.has('categories'), false)
  assert.equal(url.searchParams.has('is_endpoint_verified'), false)
  assert.equal(request.headers.get('x-api-key'), null)
})

test('sends configured authentication only as X-API-Key', async () => {
  env.SCAN8004_API_KEY = 'test-key'
  let headers: Headers | undefined
  globalThis.fetch = async (_input, init) => {
    headers = new Headers(init?.headers)
    return listResponse()
  }

  await listAgents({ cursor: '3' })

  assert.ok(headers)
  assert.equal(headers.get('x-api-key'), 'test-key')
  assert.equal(headers.get('authorization'), null)
})

test('serves a fresh cached list without another upstream request', async () => {
  env.SCAN8004_API_KEY = undefined
  let requests = 0
  globalThis.fetch = async () => {
    requests += 1
    return listResponse()
  }

  await listAgents({ cursor: '4' })
  const cached = await listAgents({ cursor: '4' })

  assert.equal(cached.stale, false)
  assert.equal(requests, 1)
})
