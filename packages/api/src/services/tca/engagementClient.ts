/**
 * TCA Onboarding Engine — Engagement REST Client
 *
 * Handles outbound REST calls to the TCA API:
 *   POST /api/v1/engagements  — create engagement at Gate 1
 *
 * Authentication: Bearer token from TCA_API_KEY env var.
 * TCA_API_URL unset → throws (caller must guard with TCA_API_URL check).
 */

import { logger } from '../../lib/logger'

export interface CreateEngagementInput {
  entity_type:       string   // 'TCM'
  entity_version:    string   // '1.0'
  credential_class:  string   // '0x0001'
  session_id:        string
  participant_email: string
  jurisdiction:      string
}

export interface CreateEngagementResult {
  engagement_id: string
  status:        string   // 'DRAFT' on creation
  created_at:    string
}

export async function createTcaEngagement(
  input: CreateEngagementInput
): Promise<CreateEngagementResult> {
  const baseUrl = process.env.TCA_API_URL
  if (!baseUrl) throw new Error('TCA_API_URL not configured')

  const apiKey = process.env.TCA_API_KEY
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
  }

  const body = JSON.stringify({
    entity_type:      input.entity_type,
    entity_version:   input.entity_version,
    credential_class: input.credential_class,
    external_ref:     input.session_id,
    metadata: {
      participant_email: input.participant_email,
      jurisdiction:      input.jurisdiction,
      source:            'TCM',
    },
  })

  const res = await fetch(`${baseUrl}/api/v1/engagements`, {
    method:  'POST',
    headers,
    body,
    signal:  AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.error({ status: res.status, body: text }, 'TCA createEngagement failed')
    throw new Error(`TCA API returned ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as CreateEngagementResult
  if (!data.engagement_id) {
    throw new Error('TCA API response missing engagement_id')
  }

  return data
}
