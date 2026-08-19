/**
 * apps/api/src/logger.ts
 *
 * Single pino instance for the API (ARCHITECTURE.md §6 observability: "pino
 * logs → Railway dashboard"). Pretty-printed in dev, JSON in production.
 *
 * Redaction: KEEPER_ATTESTER_KEY, DEMO_AGENT_PRIVATE_KEY, and anything
 * named/nested as *apiKey / *secret / *privateKey must never reach a log
 * line (CLAUDE.md §4). Callers should still never pass secret values as log
 * fields — this redaction list is a backstop, not a license to log secrets
 * under a "safe-looking" key.
 */

import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'KEEPER_ATTESTER_KEY',
      '*.KEEPER_ATTESTER_KEY',
      'DEMO_AGENT_PRIVATE_KEY',
      '*.DEMO_AGENT_PRIVATE_KEY',
      'ALTANA_WALLET_PRIVATE_KEY',
      '*.ALTANA_WALLET_PRIVATE_KEY',
      'ALTANA_FUNDING_PRIVATE_KEY',
      '*.ALTANA_FUNDING_PRIVATE_KEY',
      '*.apiKey',
      '*.api_key',
      '*.secret',
      '*.privateKey',
      '*.private_key',
      'req.headers.authorization',
    ],
    censor: '[redacted]',
  },
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
})
