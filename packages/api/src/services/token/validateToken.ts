/**
 * validateToken — Auth API read path (TCM-CRED-VERIFY-002)
 *
 * Reads from credential_state_mirror (Store 2) ONLY.
 * Never calls Polygon PoS RPC on the hot path.
 * SLA: p50 <50ms, p95 ≤150ms, p99 ≤300ms
 */

import { db } from '../../db'
import type { CredentialStatus, PermissionTier } from '@tcm/shared'

export interface ValidateTokenResult {
  status:            CredentialStatus
  permission_tier:   PermissionTier
  verified_at:       string | null
  network_id:        string
  jurisdiction_code: string
}

export async function validateToken(token_id: string): Promise<ValidateTokenResult | null> {
  const result = await db.query<{
    status:            string
    permission_tier:   string | null
    activated_at:      string | null
    network_id:        string
    jurisdiction_code: string
  }>(
    `SELECT status, permission_tier, activated_at, network_id, jurisdiction_code
     FROM credential_state_mirror
     WHERE token_id = $1`,
    [token_id]
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]!
  return {
    status:            row.status as CredentialStatus,
    permission_tier:   (row.permission_tier ?? null) as PermissionTier,
    verified_at:       row.activated_at,
    network_id:        row.network_id,
    jurisdiction_code: row.jurisdiction_code,
  }
}
