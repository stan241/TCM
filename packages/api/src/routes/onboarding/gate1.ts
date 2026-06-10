import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { db, commercialDb, auditDb } from '../../db'
import { createAuditEvent } from '../../services/audit/auditWriter'
import { logger } from '../../lib/logger'

export const gate1Router = Router()

/**
 * POST /api/v1/onboarding/gate1/confirm-purchase
 *
 * Doc10 §III Gate 1:
 * - Records purchase intent and payment reference
 * - Marks gate1_passed = true on the session
 * - Creates order record in tcm_commercial
 * - Does NOT collect payment directly — payment handled by payment processor
 *   (Stripe or similar). This endpoint records the confirmed payment reference.
 * - SDN check already passed at pre-gate — not repeated here
 */
gate1Router.post('/confirm-purchase', async (req: Request, res: Response) => {
  const schema = z.object({
    session_id:  z.string().uuid(),
    payment_ref: z.string().min(1),   // Payment processor transaction ID
    email:       z.string().email(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }

  const { session_id, payment_ref, email } = parsed.data

  try {
    // ── Verify session exists and pre-gate passed ─────────────────────────────
    const sessionResult = await db.query(
      `SELECT session_id, pre_gate_passed, gate1_passed, expires_at
       FROM onboarding_session
       WHERE session_id = $1 AND expires_at > now()`,
      [session_id]
    )

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    }

    const session = sessionResult.rows[0]

    if (!session.pre_gate_passed) {
      return res.status(400).json({ error: 'PRE_GATE_NOT_PASSED', message: 'Complete pre-gate before Gate 1.' })
    }

    if (session.gate1_passed) {
      return res.status(200).json({ gate1_passed: true, message: 'Already completed.' })
    }

    // ── Create order in commercial DB ─────────────────────────────────────────
    const orderResult = await commercialDb.query(
      `INSERT INTO orders
         (order_type, participant_email, sku, quantity, unit_price_cents, total_cents, status)
       VALUES ('INDIVIDUAL_PURCHASE', $1, 'TCT-0x0001-v1', 1, 50000, 50000, 'PAID')
       RETURNING order_id`,
      [email]
    )
    const order_id = orderResult.rows[0].order_id

    // ── Create invoice ────────────────────────────────────────────────────────
    const invoice_number = `INV-${Date.now()}`
    await commercialDb.query(
      `INSERT INTO invoices (order_id, invoice_number, amount_cents, paid_at, payment_ref)
       VALUES ($1, $2, 50000, now(), $3)`,
      [order_id, invoice_number, payment_ref]
    )

    // ── Mark gate1_passed on session ──────────────────────────────────────────
    await db.query(
      `UPDATE onboarding_session
       SET gate1_passed = true, current_gate = 2, updated_at = now()
       WHERE session_id = $1`,
      [session_id]
    )

    // ── Audit ─────────────────────────────────────────────────────────────────
    await createAuditEvent({
      actor_type:  'HUMAN',
      actor_id:    email,
      action:      'onboarding.gate1_passed',
      object_type: 'OnboardingSession',
      object_id:   session_id,
      metadata:    { order_id, invoice_number, payment_ref },
    })

    logger.info({ session_id, order_id, action: 'gate1_passed' }, 'Gate 1 purchase confirmed')

    return res.status(200).json({
      gate1_passed:    true,
      order_id,
      invoice_number,
      next_gate:       2,
    })

  } catch (err) {
    logger.error({ err }, 'gate1/confirm-purchase error')
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})
