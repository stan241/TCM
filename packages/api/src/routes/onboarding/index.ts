import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { db } from '../../db'
import { sdnCheck } from '../../services/kyc/sdnCheck'
import { createAuditEvent } from '../../services/audit/auditWriter'
import { emitEngagementEvent, buildEngagementEvent } from '../../services/tca/engagementEvents'
import { createTcaEngagement } from '../../services/tca/engagementClient'
import { logger } from '../../lib/logger'

export const onboardingRouter = Router()

/**
 * POST /api/v1/onboarding/initiate
 *
 * Doc10 §III Pre-gate:
 * - Creates onboarding session (server-side, PostgreSQL)
 * - Fires pre-purchase SDN/sanctions check immediately
 * - Blocks buyer BEFORE payment collected if SDN hit (Doc2 §II — non-waivable)
 * - No credential-class selection in v1 — single class 0x0001 only
 * - Returns session_id for client to carry through gates
 * - Session TTL: 7 days
 */
onboardingRouter.post('/initiate', async (req: Request, res: Response) => {
  const schema = z.object({
    legal_name:   z.string().min(2).max(200),
    email:        z.string().email(),
    jurisdiction: z.string().min(2).max(4).toUpperCase(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }

  const { legal_name, email, jurisdiction } = parsed.data

  try {
    // ── Step 1: Pre-purchase SDN/sanctions check ──────────────────────────────
    // Doc2 §II: buyer blocked BEFORE payment is collected. Non-waivable.
    const sanctions = await sdnCheck(legal_name, jurisdiction)

    if (sanctions.blocked) {
      // Audit the block — never silent
      await createAuditEvent({
        actor_type:  'SYSTEM',
        actor_id:    'onboarding.initiate',
        action:      'onboarding.sdn_blocked',
        object_type: 'OnboardingSession',
        object_id:   null,
        metadata:    { jurisdiction, reason: sanctions.reason },
      })

      logger.warn({ action: 'sdn_blocked', jurisdiction }, 'Pre-purchase SDN block triggered')

      // Return generic message — do not reveal SDN list details to requester
      return res.status(403).json({
        error:   'ELIGIBILITY_BLOCKED',
        message: 'We are unable to process this application. Please contact support.',
      })
    }

    // ── Step 2: Create onboarding session ─────────────────────────────────────
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const result = await db.query<{ session_id: string }>(
      `INSERT INTO onboarding_session
         (participant_email, current_gate, pre_gate_passed, expires_at)
       VALUES ($1, 1, true, $2)
       RETURNING session_id`,
      [email, expiresAt]
    )

    const session_id = result.rows[0]!.session_id

    // ── Step 3: Create TCA engagement (Option B Gate 1) ──────────────────────
    // Best-effort — failure does not block session creation.
    // tca_engagement_id stored on session; used as hard gate at Gate 4.
    let tca_engagement_id: string | null = null
    if (process.env.TCA_API_URL) {
      try {
        const engagement = await createTcaEngagement({
          entity_type:      'TCM',
          entity_version:   '1.0',
          credential_class: '0x0001',
          session_id,
          participant_email: email,
          jurisdiction,
        })
        tca_engagement_id = engagement.engagement_id

        await db.query(
          `UPDATE onboarding_session
           SET tca_engagement_id = $1, tca_engagement_status = 'DRAFT', updated_at = now()
           WHERE session_id = $2`,
          [tca_engagement_id, session_id]
        )

        emitEngagementEvent(
          buildEngagementEvent('engagement.created', tca_engagement_id, session_id, {
            jurisdiction, credential_class: '0x0001',
          })
        ).catch(err => logger.error({ err }, 'TCA engagement.created event failed (non-blocking)'))

        logger.info({ session_id, tca_engagement_id }, 'TCA engagement created')
      } catch (err) {
        logger.error({ err, session_id }, 'TCA engagement creation failed — continuing without TCA (best-effort)')
      }
    }

    // ── Step 4: Audit the session creation ───────────────────────────────────
    await createAuditEvent({
      actor_type:  'HUMAN',
      actor_id:    email,
      action:      'onboarding.session_created',
      object_type: 'OnboardingSession',
      object_id:   session_id,
      metadata:    { jurisdiction, sdn_checked: true, sdn_blocked: false, tca_engagement_id },
    })

    logger.info({ session_id, action: 'session_created' }, 'Onboarding session initiated')

    return res.status(201).json({
      session_id,
      current_gate:    1,
      pre_gate_passed: true,
      expires_at:      expiresAt.toISOString(),
      tca_engagement_id: tca_engagement_id ?? undefined,
      // Purchase price display (Doc10 §III Gate 1)
      purchase: {
        sku:          'TCT-0x0001-v1',
        amount_cents: 50000,
        currency:     'USD',
        description:  'TokenCap Token credential — Credential Class 0x0001',
      },
    })
  } catch (err) {
    logger.error({ err }, 'onboarding/initiate error')
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/onboarding/session/:session_id
 * Resume an existing session (email + OTP verified upstream by NextAuth)
 */
onboardingRouter.get('/session/:session_id', async (req: Request, res: Response) => {
  const { session_id } = req.params

  try {
    const result = await db.query(
      `SELECT session_id, current_gate, pre_gate_passed,
              gate1_passed, gate2_passed, gate3_passed,
              gate4_passed, gate5_passed, token_id,
              credential_status, activated_at, expires_at
       FROM onboarding_session
       WHERE session_id = $1 AND expires_at > now()`,
      [session_id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    }

    return res.status(200).json(result.rows[0])
  } catch (err) {
    logger.error({ err }, 'onboarding/session GET error')
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})
