/**
 * SDN / Sanctions Check Service
 *
 * Doc2 §II — SDN KILL SWITCH rules:
 * 1. Pre-purchase: fires at Gate 1 eligibility check, BEFORE payment collected.
 *    Buyer on sanctions list → blocked from purchasing entirely.
 * 2. Post-activation: constant SDN monitoring. Any hit → REVOCATION_ROLE_TCM
 *    immediately REVOKES the credential. Terminal action.
 *
 * Vendor-agnostic: calls KYC adapter interface.
 * Production: JPM handles SDN/PEP screening.
 * Dev/staging: Persona sandbox.
 */

import { getKYCAdapter } from './adapterFactory'

export interface SDNCheckResult {
  blocked:   boolean
  reason?:   string
  vendor_ref?: string
}

export async function sdnCheck(
  legal_name:   string,
  jurisdiction: string
): Promise<SDNCheckResult> {
  const adapter = getKYCAdapter()

  try {
    const result = await adapter.checkSanctions(legal_name, jurisdiction)
    return {
      blocked:   result.blocked,
      reason:    result.blocked ? 'SDN/PEP sanctions list match' : undefined,
    }
  } catch (err) {
    // SDN check failure is FAIL-CLOSED — if we cannot check, we block
    // Do not allow onboarding to proceed without a confirmed CLEAR result
    console.error('[sdnCheck] SDN check service error — blocking as precaution', err)
    return {
      blocked: true,
      reason:  'SDN check service unavailable — blocked as precaution',
    }
  }
}
