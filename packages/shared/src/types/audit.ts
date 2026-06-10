/**
 * Audit types — TCM v4
 * Source of truth: TCM-AUDIT-008 v4
 * CRITICAL: Audit log is append-only. No UPDATE or DELETE. Ever.
 */

export type AuditActorType = 'HUMAN' | 'SERVICE' | 'SYSTEM'

/** Audit event schema — Doc8 §I */
export interface AuditEvent {
  audit_event_id: string      // UUID PK
  actor_type: AuditActorType
  actor_id: string            // user UUID, service name, or system identifier
  action: string              // e.g. 'token.activated', 'credential.revoked'
  object_type: string         // e.g. 'TCTCredential', 'ComplianceCase'
  object_id: string           // UUID of the specific object
  before_hash: string | null  // bytes32 SHA-256. Null for create events.
  after_hash: string          // bytes32 SHA-256
  metadata: Record<string, unknown>  // jurisdiction, network_id, result_type, etc.
  event_time: string          // ISO8601 timestamptz
  chain_prev_hash: string     // bytes32 — hash of immediately preceding event
  chain_hash: string          // SHA-256(audit_event_id + after_hash + chain_prev_hash)
}

/** Finality states — Doc4 §IV, Doc8 §II */
export type FinalityState = 'OBSERVED' | 'SOFT_FINAL' | 'OPERATIONAL_FINAL' | 'AUDIT_FINAL'

export const FINALITY_BLOCKS = {
  SOFT_FINAL: 32,
  OPERATIONAL_FINAL: 64,
  AUDIT_FINAL: 128,
} as const

/** Revenue recognition rule: no revenue until AUDIT_FINAL — Doc8 §II */
export function isAuditFinal(blockConfirmations: number): boolean {
  return blockConfirmations >= FINALITY_BLOCKS.AUDIT_FINAL
}
