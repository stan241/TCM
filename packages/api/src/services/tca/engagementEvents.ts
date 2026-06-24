/**
 * TCA Onboarding Engine — Engagement Event Emitter (Option B integration)
 *
 * TCM fires outbound events to TCA at key lifecycle points:
 *   - engagement.created  (Gate 1 — session initiated)
 *   - engagement.approved (Gate 4 — mintAndActivate called)
 *   - engagement.closed   (credential REVOKED or RETIRED)
 *
 * Transport: REST webhook with HMAC-SHA256 signature (2678-POL-API-001 §4.3)
 * Signing key: TCA_HMAC_SIGNING_KEY env var — rotated via Secrets Manager in prod
 *
 * Fail behaviour: event emission is best-effort at Gate 1/5.
 * At Gate 4 it is BLOCKING — mintAndActivate MUST NOT proceed if TCA
 * engagement status is not APPROVED (checked before calling this function).
 */

import { createHmac } from 'crypto'
import { logger } from '../../lib/logger'

export type EngagementEventType =
  | 'engagement.created'
  | 'engagement.approved'
  | 'engagement.closed'

export interface EngagementEvent {
  event_type:      EngagementEventType
  engagement_id:   string           // TCA engagement UUID
  session_id:      string           // TCM session UUID (correlation)
  entity_type:     'TCM'
  entity_version:  '1.0'
  credential_class: '0x0001'
  timestamp:       string           // ISO-8601
  metadata?:       Record<string, unknown>
}

export interface EmitResult {
  sent:       boolean
  status?:    number
  error?:     string
}

function signPayload(payload: string): string {
  const key = process.env.TCA_HMAC_SIGNING_KEY
  if (!key) {
    // Dev: no key configured — skip signing, log warning
    logger.warn('TCA_HMAC_SIGNING_KEY not set — engagement events unsigned (dev only)')
    return 'unsigned'
  }
  return createHmac('sha256', key).update(payload).digest('hex')
}

export async function emitEngagementEvent(event: EngagementEvent): Promise<EmitResult> {
  const webhookUrl = process.env.TCA_WEBHOOK_URL
  if (!webhookUrl) {
    logger.warn({ event_type: event.event_type }, 'TCA_WEBHOOK_URL not set — skipping engagement event (dev mode)')
    return { sent: false, error: 'TCA_WEBHOOK_URL not configured' }
  }

  const payload   = JSON.stringify(event)
  const signature = signPayload(payload)

  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-TCA-Signature':  `sha256=${signature}`,
        'X-TCA-Event-Type': event.event_type,
      },
      body:    payload,
      signal:  AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      logger.error(
        { event_type: event.event_type, status: res.status },
        'TCA engagement event delivery failed'
      )
      return { sent: false, status: res.status, error: `HTTP ${res.status}` }
    }

    logger.info(
      { event_type: event.event_type, engagement_id: event.engagement_id, session_id: event.session_id },
      'TCA engagement event delivered'
    )
    return { sent: true, status: res.status }

  } catch (err: any) {
    logger.error({ event_type: event.event_type, err: err.message }, 'TCA engagement event fetch error')
    return { sent: false, error: err.message }
  }
}

/** Build a well-formed engagement event from session context */
export function buildEngagementEvent(
  type:          EngagementEventType,
  engagementId:  string,
  sessionId:     string,
  metadata?:     Record<string, unknown>
): EngagementEvent {
  return {
    event_type:       type,
    engagement_id:    engagementId,
    session_id:       sessionId,
    entity_type:      'TCM',
    entity_version:   '1.0',
    credential_class: '0x0001',
    timestamp:        new Date().toISOString(),
    metadata,
  }
}
