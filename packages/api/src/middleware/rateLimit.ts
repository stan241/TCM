import rateLimit from 'express-rate-limit'

/**
 * Rate limiter factory
 * Auth API default: 1,000 requests per 5 minutes per caller IP — Doc5 §I
 * On 429: TCN must use exponential backoff with jitter. retry_after in response.
 */
export function rateLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  return rateLimit({
    max,
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip ?? 'unknown',
    handler: (_req, res) => {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Use exponential backoff with jitter.',
        retry_after: Math.ceil(windowMs / 1000),
      })
    },
  })
}
