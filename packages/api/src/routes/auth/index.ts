import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { rateLimiter } from '../../middleware/rateLimit'
import { validateToken } from '../../services/token/validateToken'
import type { AuthValidateResponse } from '@tcm/shared'

export const authRouter = Router()

/**
 * POST /auth/v1/validate-token
 * TCM-CRED-VERIFY-002 — LOCKED schema, mTLS only
 *
 * Doc5 §I–VI:
 * - Request: exactly { token_id: string }. Additional fields → 400.
 * - Response: status, permission_tier, verified_at, network_id, jurisdiction_code ONLY.
 * - NO PII. NO identity data. NO compliance detail.
 * - Source: credential_state_mirror DB read — NOT an RPC call to Polygon PoS.
 * - SLA: p50 <50ms, p95 ≤150ms, p99 ≤300ms
 * - On TCM 503: TCN MUST fail closed — deny ALL participant access. No cached override.
 */
authRouter.post(
  '/validate-token',
  rateLimiter({ max: 1000, windowMs: 5 * 60 * 1000 }), // 1,000 req / 5 min per caller IP
  async (req: Request, res: Response) => {
    // Schema: exactly one field — reject additional fields
    const schema = z.object({ token_id: z.string() }).strict()
    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Request must contain exactly { token_id: string } and no other fields.',
      })
    }

    try {
      const result = await validateToken(parsed.data.token_id)

      if (!result) {
        return res.status(404).json({
          error: 'TOKEN_NOT_FOUND',
          message: 'token_id not in registry. Deny access.',
        })
      }

      const response: AuthValidateResponse = {
        status:          result.status,
        permission_tier: result.permission_tier,
        verified_at:     result.verified_at,
        network_id:      result.network_id,
        jurisdiction_code: result.jurisdiction_code,
      }

      return res.status(200).json(response)

    } catch (err) {
      // 503 — TCN must fail closed on this response
      console.error('[auth] validate-token error', err)
      return res.status(503).json({
        error: 'TCM_UNAVAILABLE',
        message: 'TCM service unavailable. TCN must deny all participant access immediately.',
      })
    }
  }
)
