/**
 * apps/api/src/routes/v1/faucet.ts
 *
 * POST /v1/faucet — drip test $U + tBNB to a hirer (rate-limited, 24h/address).
 * The faucet wallet is a funded EOA owned by the platform; this endpoint only
 * ever sends FROM it, never reads its key.
 */
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { cooldownRemainingMs, drip } from '../../services/faucet.js'

export const faucetRouter = new Hono()

const bodySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'invalid EVM address'),
})

/** POST /v1/faucet — ERD.md §4 auxiliary (testnet-only helper). */
faucetRouter.post('/faucet', zValidator('json', bodySchema), async (c) => {
  const { address } = c.req.valid('json')

  const remaining = cooldownRemainingMs(address)
  if (remaining > 0) {
    return c.json(
      { success: false, error: 'rate_limited', retryAfterMs: remaining },
      429,
    )
  }

  try {
    const result = await drip(address as `0x${string}`)
    return c.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'faucet error'
    return c.json({ success: false, error: message }, 503)
  }
})
