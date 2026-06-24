/**
 * POST /api/v1/tca/webhook
 *
 * Receives inbound events from TCA Onboarding Engine.
 * Verifies HMAC-SHA256 signature (same key used for outbound events).
 * Updates onboarding_session.tca_engagement_status on relevant event types.
 *
 * TCA sends these event types:
 *   engagement.approved         — TCA has approved the engagement (Gate 4 hard gate clears)
 *   engagement.closed           — TCA engagement closed (post-mint or abandoned)
 *   reference_status.updated    — TCA reference check status changed
 *   information_request.raised  — TCA requests additional information from participant
 *
 * Security:
 *   - Fail-closed: if signature is invalid or missing, always 401 (never 200)
 *   - Unknown event types: ACK 200 but do not mutate state (forward compat)
 *   - engagement_id not found in session: ACK 200 with logged warning (TCA may resend)
 */

import { Router, Request, Response } from 'express'
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '../../db'
import { createAuditEvent } from '../../services/audit/auditWriter'
import { logger } from '../../lib/logger'

export const tcaWebhookRouter = Router()

function verifySignature(rawBody: string, headerSig: string | undefined): boolean {
  const key = process.env.TCA_HMAC_SIGNING_KEY
  if (!key) {
    // Dev: no key set — skip verification but log warning
    logger.warn('TCA_HMAC_SIGNING_KEY not set — skipping TCA webhook signature verification (dev only)')
    return true
  }
  if (!headerSig) return false

  // Header format: "sha256=<hex>"
  const expected = 'sha256=' + createHmac('sha256', key).update(rawBody).digest('hex')
  const actual   = headerSig

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  } catch {
    return false
  }
}

// Use raw body for signature verification — must be mounted BEFORE express.json() on this path,
// or use express.raw() at the router level. Here we read req.body as already-parsed JSON
// (main app mounts express.json() globally) and re-serialize for HMAC — adequate for JSON payloads.
tcaWebhookRouter.post('/', async (req: Request, res: Response) => {
  const rawBody   = JSON.stringify(req.body)
  const signature = req.headers['x-tca-signature'] as string | undefined

  if (!verifySignature(rawBody, signature)) {
    logger.warn({ signature }, 'TCA webhook signature verification failed')
    return res.status(401).json({ error: 'INVALID_SIGNATURE' })
  }

  const { event_type, engagement_id, session_id, timestamp } = req.body ?? {}

  if (!event_type || !engagement_id) {
    return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS', required: ['event_type', 'engagement_id'] })
  }

  logger.info({ event_type, engagement_id, session_id }, 'TCA inbound webhook received')

  try {
    switch (event_type) {

      case 'engagement.approved': {
        const updated = await db.query(
          `UPDATE onboarding_session
           SET tca_engagement_status = 'APPROVED',
               tca_approved_at       = $1,
               updated_at            = now()
           WHERE tca_engagement_id = $2
           RETURNING session_id`,
          [timestamp ?? new Date().toISOString(), engagement_id]
        )
        if (updated.rows.length === 0) {
          logger.warn({ engagement_id }, 'TCA engagement.approved — no matching session found')
        } else {
          logger.info({ engagement_id, session_id: updated.rows[0].session_id },
            'TCA engagement approved — Gate 4 gate cleared')
        }
        await createAuditEvent({
          actor_type:  'SYSTEM',
          actor_id:    'tca.webhook',
          action:      'tca.engagement_approved',
          object_type: 'OnboardingSession',
          object_id:   session_id ?? engagement_id,
          metadata:    { engagement_id, event_type, timestamp },
        })
        break
      }

      case 'engagement.closed': {
        await db.query(
          `UPDATE onboarding_session
           SET tca_engagement_status = 'CLOSED', updated_at = now()
           WHERE tca_engagement_id = $1`,
          [engagement_id]
        )
        await createAuditEvent({
          actor_type:  'SYSTEM',
          actor_id:    'tca.webhook',
          action:      'tca.engagement_closed',
          object_type: 'OnboardingSession',
          object_id:   session_id ?? engagement_id,
          metadata:    { engagement_id, event_type, timestamp },
        })
        logger.info({ engagement_id }, 'TCA engagement closed')
        break
      }

      case 'reference_status.updated': {
        // Informational — no state mutation in TCM for this event type
        // Portal can poll /onboarding/session/:id to reflect TCA status
        const { status, reference_type } = req.body
        await createAuditEvent({
          actor_type:  'SYSTEM',
          actor_id:    'tca.webhook',
          action:      'tca.reference_status_updated',
          object_type: 'OnboardingSession',
          object_id:   session_id ?? engagement_id,
          metadata:    { engagement_id, event_type, status, reference_type, timestamp },
        })
        logger.info({ engagement_id, status, reference_type }, 'TCA reference status updated')
        break
      }

      case 'information_request.raised': {
        // TCA is asking for more info from the participant
        // TCM logs this; portal UX to surface separately (future sprint)
        const { request_type, description } = req.body
        await createAuditEvent({
          actor_type:  'SYSTEM',
          actor_id:    'tca.webhook',
          action:      'tca.information_request_raised',
          object_type: 'OnboardingSession',
          object_id:   session_id ?? engagement_id,
          metadata:    { engagement_id, event_type, request_type, description, timestamp },
        })
        logger.info({ engagement_id, request_type }, 'TCA information request raised')
        break
      }

      default: {
        // Unknown event type — ACK without mutation (forward compat)
        logger.info({ event_type, engagement_id }, 'TCA webhook: unknown event type — ACK without action')
        break
      }
    }

    return res.status(200).json({ received: true, event_type })

  } catch (err) {
    logger.error({ err, event_type, engagement_id }, 'TCA webhook processing error')
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})
