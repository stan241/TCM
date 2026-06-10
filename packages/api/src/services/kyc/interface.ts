/**
 * KYC vendor-agnostic interface — TCM v4
 *
 * Doc2 §I: Token Engine calls THIS interface, not JPM or Persona directly.
 * Vendor swap (Persona dev → JPM prod) = config change only. Zero code change.
 *
 * JPM returns: Verified | Failed | Restricted + jurisdiction_code
 */

export type KYCResult = 'VERIFIED' | 'FAILED' | 'RESTRICTED' | 'PENDING'

export interface KYCVerificationResult {
  result: KYCResult
  jurisdiction_code: string  // ISO-style, e.g. 'US', 'GB'
  case_id: string            // Vendor case/inquiry ID for audit linkage
  verified_at: string | null // ISO8601
  failure_reason?: string    // If FAILED or RESTRICTED
}

export interface KYCInitiateParams {
  legal_name: string
  date_of_birth: string      // ISO8601 date
  ssn_last4?: string
  government_id_type: string
  government_id_number: string
  jurisdiction: string
  session_id: string         // onboarding_session_id for idempotency
}

/** The interface all KYC adapters must implement */
export interface KYCVendorAdapter {
  initiateVerification(params: KYCInitiateParams): Promise<{ case_id: string }>
  getVerificationStatus(case_id: string): Promise<KYCVerificationResult>
  /** SDN/sanctions check — must run pre-purchase (Doc2 §II) */
  checkSanctions(name: string, jurisdiction: string): Promise<{ blocked: boolean }>
}
