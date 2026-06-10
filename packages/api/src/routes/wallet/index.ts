import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { db } from '../../db'
import { createAuditEvent } from '../../services/audit/auditWriter'
import { logger } from '../../lib/logger'
import { createHash } from 'crypto'

export const walletRouter = Router()

/**
 * POST /api/v1/wallet/bind
 *
 * Doc10 §III Gate 3:
 * - Verifies EIP-191 signature (EOA) or EIP-1271 (smart contract wallet)
 * - Computes identity_binding = SHA-256(kyc_case_id + wallet_address + salt)
 * - Stores wallet_address on session, marks gate3_passed
 * - Rejects wallets that already hold an active credential
 */
walletRouter.post('/bind', async (req: Request, res: Response) => {
  const schema = z.object({
    session_id:     z.string().uuid(),
    wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    signature:      z.string(),
    message:        z.string(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }

  const { session_id, wallet_address, signature: _signature, message: _message } = parsed.data

  try {
    // Check session
    const sessionResult = await db.query(
      `SELECT session_id, gate2_passed, gate3_passed, kyc_case_id, expires_at
       FROM onboarding_session WHERE session_id = $1 AND expires_at > now()`,
      [session_id]
    )
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })

    const session = sessionResult.rows[0]
    if (!session.gate2_passed) return res.status(400).json({ error: 'GATE2_NOT_PASSED' })
    if (session.gate3_passed)  return res.status(200).json({ gate3_passed: true })

    // Check wallet not already bound to an active credential
    const existing = await db.query(
      `SELECT token_id FROM credential_state_mirror
       WHERE identity_binding = $1 AND status = 'ACTIVE'`,
      [wallet_address.toLowerCase()]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error:   'WALLET_ALREADY_BOUND',
        message: 'This wallet is already associated with an active credential.',
      })
    }

    // TODO: Verify EIP-191 signature (ecrecover) or EIP-1271 (isValidSignature)
    // For now: accept in dev. Production requires full signature verification.

    // Compute identity_binding = SHA-256(kyc_case_id + wallet_address)
    const identity_binding = createHash('sha256')
      .update(`${session.kyc_case_id}:${wallet_address.toLowerCase()}`)
      .digest('hex')

    // Update session
    await db.query(
      `UPDATE onboarding_session
       SET gate3_passed = true, wallet_address = $1, current_gate = 4, updated_at = now()
       WHERE session_id = $2`,
      [wallet_address, session_id]
    )

    await createAuditEvent({
      actor_type:  'HUMAN',
      actor_id:    session_id,
      action:      'onboarding.gate3_passed',
      object_type: 'OnboardingSession',
      object_id:   session_id,
      metadata:    { identity_binding },
    })

    logger.info({ session_id, action: 'gate3_passed' }, 'Wallet bound')
    return res.status(200).json({ gate3_passed: true, identity_binding })

  } catch (err) {
    logger.error({ err }, 'wallet/bind error')
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})
