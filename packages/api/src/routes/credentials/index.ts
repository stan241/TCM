import { Router, Request, Response } from 'express'
import { db, auditDb } from '../../db'
import { logger } from '../../lib/logger'

export const credentialsRouter = Router()

/** GET /api/v1/credentials/:token_id */
credentialsRouter.get('/:token_id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT token_id, status, permission_tier, jurisdiction_code,
              activated_at, network_id, issued_at
       FROM credential_state_mirror WHERE token_id = $1`,
      [req.params.token_id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' })
    return res.status(200).json(result.rows[0])
  } catch (err) {
    logger.error({ err }, 'credentials GET error')
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

/** GET /api/v1/credentials/:token_id/activity */
credentialsRouter.get('/:token_id/activity', async (req: Request, res: Response) => {
  try {
    const result = await auditDb.query(
      `SELECT action, event_time, metadata
       FROM audit_log
       WHERE object_id::text = $1
       ORDER BY event_time DESC LIMIT 50`,
      [req.params.token_id]
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    logger.error({ err }, 'credentials/activity GET error')
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})
