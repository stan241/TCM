/**
 * Persona SDK configuration — TCM Client Intake Portal
 *
 * Doc10 §V:
 * - Persona Embedded Flow — React component, embedded in portal
 * - No redirect away from portal
 * - Dev/staging only — JPM replaces in production (zero code change)
 *
 * Doc2 §I: KYC service is vendor-agnostic. Vendor swap = config change only.
 * KYC_VENDOR env var controls which adapter the API uses.
 * The portal always uses Persona Embedded Flow for the UI component in dev/staging.
 */

export const personaConfig = {
  templateId: process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ID ?? '',
  environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as
    'production' | 'sandbox',
}

/**
 * Persona inquiry status polling interval (ms)
 * Doc10 §III Gate 2: "Status updates via polling. Estimated 1–3 minutes."
 */
export const PERSONA_POLL_INTERVAL_MS = 3_000  // poll every 3 seconds

/**
 * Map Persona inquiry status to TCM compliance_status
 */
export function mapPersonaStatus(
  personaStatus: string
): 'VERIFIED' | 'FAILED' | 'RESTRICTED' | 'PENDING' {
  switch (personaStatus) {
    case 'approved':   return 'VERIFIED'
    case 'declined':   return 'FAILED'
    case 'needs_review':
    case 'pending':    return 'PENDING'
    case 'expired':
    case 'failed':     return 'FAILED'
    default:           return 'PENDING'
  }
}
