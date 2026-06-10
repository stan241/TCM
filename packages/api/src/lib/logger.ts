/**
 * Structured logger — wraps pino
 * All logs are structured JSON. PII must never appear in logs.
 */
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'legal_name', 'email', 'ssn_last4',
      'government_id_number', 'wallet_address',
      'req.headers.authorization',
      'req.headers["x-client-cert"]',
    ],
    censor: '[REDACTED]',
  },
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})
