/**
 * Shared credential types — TCM v4
 * Source of truth: TCM-STATEMACHINE-006 v4, TCM-AUTH-API-005 v4
 */

/** Six-state credential machine — Doc1 §V, Doc6 §II
 *  NOTE: Pending is OFF-CHAIN ONLY. No on-chain token exists in Pending state.
 *  Mint fires at Active (Rev 4 change). */
export type CredentialStatus =
  | 'PENDING'    // Off-chain onboarding session state only. No on-chain token.
  | 'ACTIVE'     // isAuthorized = true. On-chain. KYC verified.
  | 'SUSPENDED'  // Reversible. Compliance event or contract breach.
  | 'REVOKED'    // TERMINAL. Sanctions, fraud, program exit. Never burned.
  | 'EXPIRED'    // Time-based. Renewable.
  | 'RETIRED'    // Dormant. Fresh KYC required on reactivation.
  | 'NOT_FOUND'  // Auth API only — token_id not in registry

/** Permission tiers — Doc5 §IV */
export type PermissionTier = 'VIEWER' | 'PARTICIPANT' | null

/** Compliance / KYC status — Doc6 §IV */
export type ComplianceStatus = 'VERIFIED' | 'PENDING' | 'FAILED' | 'RESTRICTED'

/** Auth API response schema — TCM-CRED-VERIFY-002 LOCKED — Doc5 §III
 *  NO identity data. NO PII. NO compliance detail. */
export interface AuthValidateResponse {
  status: CredentialStatus
  permission_tier: PermissionTier
  verified_at: string | null   // ISO8601
  network_id: string
  jurisdiction_code: string
}

/** Auth API request schema — LOCKED — Doc5 §II
 *  Exactly one field. Additional fields → 400 Bad Request. */
export interface AuthValidateRequest {
  token_id: string  // e.g. "0x0001000000000001"
}

/** Credential record — on-chain fields mirrored off-chain — Doc6 §IV */
export interface CredentialRecord {
  token_id: string           // uint256 as hex string. Assigned at mint (Active state).
  network_id: string         // bytes8. Required from first write.
  identity_binding: string   // bytes32 SHA-256 hash. Never PII.
  status: Exclude<CredentialStatus, 'PENDING' | 'NOT_FOUND'>  // On-chain: no Pending
  compliance_status: ComplianceStatus
  jurisdiction_code: string  // bytes4 ISO-style
  claims_version: number     // uint32
  // Seven timestamps (null = not yet set)
  issued_at: string | null
  activated_at: string | null
  updated_at: string | null
  suspended_at: string | null
  revoked_at: string | null
  expired_at: string | null
  retired_at: string | null
  audit_root_hash: string    // bytes32
}

/** Credential class — v1 has only one class */
export const CREDENTIAL_CLASS_V1 = '0x0001' as const
