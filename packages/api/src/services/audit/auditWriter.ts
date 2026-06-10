/**
 * Audit Writer Service
 *
 * TCM-AUDIT-008 v4 §I — every material action writes to the audit log.
 * APPEND-ONLY. NO UPDATE. NO DELETE. EVER.
 * chain_hash = SHA-256(audit_event_id + after_hash + chain_prev_hash)
 *
 * Uses the audit_log DB (Store 4) — separate connection from operational stores.
 */

import { createHash, randomUUID } from 'crypto'
import { auditDb } from '../../db'

interface AuditEventInput {
  actor_type:  'HUMAN' | 'SERVICE' | 'SYSTEM'
  actor_id:    string
  action:      string
  object_type: string
  object_id:   string | null
  before_hash?: string
  after_hash?:  string
  metadata:    Record<string, unknown>
}

export async function createAuditEvent(input: AuditEventInput): Promise<string> {
  const audit_event_id = randomUUID()
  const after_hash     = input.after_hash ?? sha256(JSON.stringify(input.metadata))
  const before_hash    = input.before_hash ?? null

  // Get chain_prev_hash — the most recent audit event's chain_hash
  const prevResult = await auditDb.query<{ chain_hash: string }>(
    `SELECT chain_hash FROM audit_log ORDER BY event_time DESC LIMIT 1`
  )
  const chain_prev_hash = prevResult.rows[0]?.chain_hash ?? sha256('GENESIS')

  // chain_hash = SHA-256(audit_event_id + after_hash + chain_prev_hash)
  const chain_hash = sha256(audit_event_id + after_hash + chain_prev_hash)

  await auditDb.query(
    `INSERT INTO audit_log
       (audit_event_id, actor_type, actor_id, action, object_type, object_id,
        before_hash, after_hash, metadata, event_time, chain_prev_hash, chain_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,$11)`,
    [
      audit_event_id,
      input.actor_type,
      input.actor_id,
      input.action,
      input.object_type,
      input.object_id ?? audit_event_id, // use self-ID for create events
      before_hash,
      after_hash,
      JSON.stringify(input.metadata),
      chain_prev_hash,
      chain_hash,
    ]
  )

  return audit_event_id
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
