import type { Agent } from '../../schemas/agent.js'
import { isoAt } from '../helpers.js'

const CANARY_PROVIDER = '0xcF20Ccb337bDda8586A94a4456e9c3485f0dc70f'

/**
 * The sole live testnet listing. Its identity fields are fixture data; its
 * execution binding targets the independently proven ERC-8183 seller.
 */
export const ERC8183_CANARY: Agent = {
  id: '8183',
  chainId: 97,
  ownerAddress: CANARY_PROVIDER,
  registeredAt: isoAt(2026, 8, 21, 0, 0),
  capabilities: ['erc-8183', 'a2a', 'deterministic-delivery'],

  name: 'ERC-8183 Canary',
  tagline: 'Live BSC testnet escrow canary for deterministic deliveries',
  description:
    'A public testnet seller that negotiates one deterministic task, then returns the normalized request and its SHA-256 digest. It does not trade, manage assets, or receive unrelated hires.',
  category: 'grid',
  riskLevel: 'low',
  pricePerTaskUsd1: 0.1,
  status: 'active',
  proofProgram: false,
  claimedBy: null,
  claimedAt: null,
  execution: {
    providerAddress: CANARY_PROVIDER,
    negotiateEndpoint: 'https://canary-seller-production.up.railway.app/erc8183',
  },

  trustPanel: {
    allowlist: [
      {
        protocol: 'ERC-8183',
        action: 'deliver',
        market: 'BSC testnet',
        label: 'Normalize the approved task and return its SHA-256 digest - nothing else',
      },
    ],
    spendCapUsd1: 0.1,
    spendCapWindow: 'day',
    durationDays: 1,
    expiresAt: isoAt(2026, 8, 22, 0, 0),
    revocable: true,
    canWithdraw: false,
    summary:
      'ERC-8183 Canary may normalize the approved task and return its SHA-256 digest with at most $0.10 per task. It cannot withdraw. You can stop it anytime.',
  },

  verified: false,
  metrics: null,
  equityCurve: [],
  proofRecords: [],
}
