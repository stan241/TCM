/**
 * Admin API routes — internal only, not exposed via Auth API
 *
 * GET  /api/v1/admin/stats
 * GET  /api/v1/audit
 * GET  /api/v1/credentials/search
 * POST /api/v1/credentials/:token_id/suspend
 * POST /api/v1/credentials/:token_id/revoke
 */

import { Router }           from 'express'
import { db, auditDb }      from '../../db/index.js'
import { createAuditEvent } from '../../services/audit/auditWriter.js'
import { logger }           from '../../lib/logger.js'
import crypto               from 'node:crypto'

export const adminRouter = Router()

// ── Stats ─────────────────────────────────────────────────────────────────────
adminRouter.get('/stats', async (_req, res) => {
  try {
    const [mirror, audit] = await Promise.all([
      db.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count FROM credential_state_mirror GROUP BY status`
      ),
      auditDb.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM audit_log WHERE event_time > NOW() - INTERVAL '24 hours'`
      ),
    ])

    const byStatus: Record<string, number> = {}
    for (const row of mirror.rows) byStatus[row.status] = parseInt(row.count, 10)

    res.json({
      total_active:    byStatus['ACTIVE']    ?? 0,
      total_suspended: byStatus['SUSPENDED'] ?? 0,
      total_revoked:   byStatus['REVOKED']   ?? 0,
      pending_kyc:     0,   // TODO: join kyc_workflow DB
      pending_mints:   0,   // TODO: join token_requests
      audit_log_24h: parseInt(audit.rows[0]?.count ?? '0', 10),
    })
  } catch (err) {
    logger.error({ err }, 'admin/stats error')
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── Audit log ─────────────────────────────────────────────────────────────────
export const auditRouter = Router()

auditRouter.get('/', async (req, res) => {
  const limit  = Math.min(parseInt(req.query['limit']  as string ?? '50',  10), 200)
  const offset = Math.max(parseInt(req.query['offset'] as string ?? '0',   10), 0)

  try {
    const { rows } = await auditDb.query<{
      audit_event_id: string
      token_id:       string
      result_type:    string
      event_time:     string
      chain_hash:     string
      chain_prev_hash: string
      after_hash:     string
    }>(
      `SELECT audit_event_id,
              metadata->>'token_id' AS token_id,
              action AS result_type,
              event_time, chain_hash, chain_prev_hash, after_hash
       FROM   audit_log
       ORDER  BY event_time DESC
       LIMIT  $1 OFFSET $2`,
      [limit, offset]
    )

    // Verify chain_hash inline so admin can see integrity status without a separate job
    const entries = rows.map(row => {
      const computed = crypto.createHash('sha256')
        .update(row.audit_event_id + (row.after_hash ?? '') + (row.chain_prev_hash ?? ''))
        .digest('hex')
      return { ...row, hash_ok: computed === row.chain_hash, after_hash: undefined, chain_prev_hash: undefined }
    })

    res.json({ entries })
  } catch (err) {
    logger.error({ err }, 'audit GET error')
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── Credential search ─────────────────────────────────────────────────────────
export const credentialSearchRouter = Router()

credentialSearchRouter.get('/search', async (req, res) => {
  const q = (req.query['q'] as string ?? '').trim()
  if (!q) { res.json({ results: [] }); return }

  try {
    const { rows } = await db.query(
      `SELECT token_id, status, jurisdiction_code, permission_tier, activated_at
       FROM   credential_state_mirror
       WHERE  token_id            ILIKE $1
       LIMIT  50`,
      [`%${q}%`]
    )
    res.json({ results: rows })
  } catch (err) {
    logger.error({ err }, 'credentials/search error')
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── Suspend ───────────────────────────────────────────────────────────────────

credentialSearchRouter.post('/:token_id/suspend', async (req, res) => {
  const { token_id } = req.params
  const { reason }   = req.body

  if (!reason) { res.status(400).json({ error: 'reason required' }); return }

  try {
    const { rowCount } = await db.query(
      `UPDATE credential_state_mirror
       SET    status = 'SUSPENDED', updated_at = NOW()
       WHERE  token_id = $1 AND status = 'ACTIVE'`,
      [token_id]
    )
    if (!rowCount) { res.status(404).json({ error: 'NOT_FOUND_OR_NOT_ACTIVE' }); return }

    await createAuditEvent({
      actor_type:  'HUMAN',
      actor_id:    'ADMIN',
      action:      'COMPLIANCE_SUSPEND',
      object_type: 'CREDENTIAL',
      object_id:   token_id,
      before_hash: undefined,
      after_hash:  undefined,
      metadata:    { token_id, reason, before_state: 'ACTIVE', after_state: 'SUSPENDED' },
    })

    res.json({ ok: true })
  } catch (err) {
    logger.error({ err, token_id }, 'suspend error')
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── Revoke ────────────────────────────────────────────────────────────────────

credentialSearchRouter.post('/:token_id/revoke', async (req, res) => {
  const { token_id } = req.params
  const { reason }   = req.body

  if (!reason) { res.status(400).json({ error: 'reason required' }); return }

  try {
    const { rowCount } = await db.query(
      `UPDATE credential_state_mirror
       SET    status = 'REVOKED', updated_at = NOW()
       WHERE  token_id = $1 AND status NOT IN ('REVOKED','RETIRED')`,
      [token_id]
    )
    if (!rowCount) { res.status(404).json({ error: 'NOT_FOUND_OR_ALREADY_REVOKED' }); return }

    await createAuditEvent({
      actor_type:  'HUMAN',
      actor_id:    'ADMIN',
      action:      'COMPLIANCE_REVOKE',
      object_type: 'CREDENTIAL',
      object_id:   token_id,
      before_hash: undefined,
      after_hash:  undefined,
      metadata:    { token_id, reason, before_state: 'ACTIVE', after_state: 'REVOKED' },
    })

    res.json({ ok: true })
  } catch (err) {
    logger.error({ err, token_id }, 'revoke error')
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})
