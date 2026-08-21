/**
 * apps/keeper/src/logger.ts — see apps/api/src/logger.ts for rationale.
 * Redaction is the backstop for CLAUDE.md §4's "never log KEEPER_ATTESTER_KEY".
 */

import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: ['KEEPER_ATTESTER_KEY', '*.KEEPER_ATTESTER_KEY', '*.privateKey', '*.private_key'],
    censor: '[redacted]',
  },
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
})
