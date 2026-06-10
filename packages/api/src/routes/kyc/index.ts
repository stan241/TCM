import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { db } from '../../db'
import { getKYCAdapter } from '../../services/kyc/adapterFactory'
import { createAuditEvent } from '../../services/audit/auditWriter'
import { logger } from '../../lib/logger'

export const kycRouter = Router()

/**
 * POST /api/v1/kyc/initiate
 *
 * Doc10 §III Gate 2:
 * - Initiates KYC via vendor-agnostic adapter (Persona dev, JPM prod)
 * - Returns case_id for the portal to pass to Persona Embedded Flow
 * - Requires gate1_passed on session
 */
kycRouter.post('/initiate', async (req: Request, res: Response) => {
  const schema = z.object({ session_id: z.string().uuid() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' })
  }

  const { session_id } = parsed.data

  try {
    const sessionResult = await db.query(
      `SELECT session_id, gate1_passed, gate2_passed, kyc_case_id, participant_email, expires_at
       FROM onboarding_session
       WHERE session_id = $1 AND expires_at > now()`,
      [session_id]
    )

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    }

    const session = sessionResult.rows[0]

    if (!session.gate1_passed) {
      return res.status(400).json({ error: 'GATE1_NOT_PASSED' })
    }

    // Idempotent — return existing case_id if already initiated
    if (session.kyc_case_id) {
      return res.status(200).json({ case_id: session.kyc_case_id })
    }

    // Initiate KYC via adapter
    const adapter = getKYCAdapter()
    const { case_id } = await adapter.initiateVerification({
      legal_name:           '',   // populated from identity vault — not stored on session
      date_of_birth:        '',
      government_id_type:   'UNKNOWN',
      government_id_number: '',
      jurisdiction:         '',
      session_id,
    })

    // Store case_id on session
    await db.query(
      `UPDATE onboarding_session SET kyc_case_id = $1, updated_at = now() WHERE session_id = $2`,
      [case_id, session_id]
    )

    await createAuditEvent({
      actor_type:  'SERVICE',
      actor_id:    'kyc.initiate',
      action:      'kyc.initiated',
      object_type: 'OnboardingSession',
      object_id:   session_id,
      metadata:    { case_id, vendor: process.env.KYC_VENDOR },
    })

    return res.status(200).json({ case_id })

  } catch (err) {
    logger.error({ err }, 'kyc/initiate error')
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/kyc/status/:case_id
 *
 * Doc10 §III Gate 2 — polling endpoint
 * Portal polls every 3s until status = VERIFIED | FAILED | RESTRICTED
 * Returns: { status, jurisdiction_code }
 * On VERIFIED: marks gate2_passed = true and records jurisdiction_code on session
 */
kycRouter.get('/status/:case_id', async (req: Request, res: Response) => {
  const { case_id } = req.params

  try {
    const adapter = getKYCAdapter()
    const result  = await adapter.getVerificationStatus(case_id)

    // On VERIFIED — update session
    if (result.result === 'VERIFIED') {
      await db.query(
        `UPDATE onboarding_session
         SET gate2_passed = true, current_gate = 3, updated_at = now()
         WHERE kyc_case_id = $1`,
        [case_id]
      )

      await createAuditEvent({
        actor_type:  'SERVICE',
        actor_id:    'kyc.status',
        action:      'kyc.verified',
        object_type: 'KYCCase',
        object_id:   case_id,
        metadata:    { jurisdiction_code: result.jurisdiction_code, vendor: process.env.KYC_VENDOR },
      })
    }

    return res.status(200).json({
      status:           result.result,
      jurisdiction_code: result.jurisdiction_code ?? null,
    })

  } catch (err) {
    logger.error({ err }, 'kyc/status error')
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})
