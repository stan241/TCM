import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { db } from '../../db'
import { createAuditEvent } from '../../services/audit/auditWriter'
import { mintAndActivate, getBlockConfirmations, getFinalityState } from '../../services/blockchain/mintService'
import { emitEngagementEvent, buildEngagementEvent } from '../../services/tca/engagementEvents'
import { logger } from '../../lib/logger'

export const tokenRouter = Router()

/**
 * POST /api/v1/token/mint-and-activate
 *
 * Doc10 §III Gate 4 — Rev 4: mint fires at Active (single operation).
 * No on-chain token exists until this endpoint succeeds.
 * ISSUER_ROLE wallet signs the mint transaction.
 * Batch limit: max 50 tokens per tx (gas-safety ceiling).
 * Returns PROVISIONAL — portal polls /confirmation/:tx_hash for finality.
 */
tokenRouter.post('/mint-and-activate', async (req: Request, res: Response) => {
  const schema = z.object({ session_id: z.string().uuid() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION_ERROR' })

  const { session_id } = parsed.data

  try {
    const sessionResult = await db.query(
      `SELECT session_id, gate3_passed, gate4_passed, wallet_address,
              kyc_case_id, token_id, tx_hash, expires_at,
              tca_engagement_id, tca_engagement_status
       FROM onboarding_session WHERE session_id = $1 AND expires_at > now()`,
      [session_id]
    )
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })

    const session = sessionResult.rows[0]
    if (!session.gate3_passed) return res.status(400).json({ error: 'GATE3_NOT_PASSED' })

    // TCA Option B gate: engagement.approved is required before mintAndActivate
    // tca_engagement_id may be null in dev/test when TCA_WEBHOOK_URL is unset
    if (session.tca_engagement_id && session.tca_engagement_status !== 'APPROVED') {
      logger.warn({ session_id, tca_engagement_status: session.tca_engagement_status },
        'TCA engagement not approved — blocking mint')
      return res.status(403).json({
        error:   'TCA_ENGAGEMENT_NOT_APPROVED',
        message: 'TCA engagement must be in APPROVED state before credential can be minted.',
        tca_engagement_status: session.tca_engagement_status,
      })
    }

    // Idempotent — return existing result if already minted
    if (session.gate4_passed && session.token_id) {
      return res.status(200).json({
        gate4_passed: true,
        token_id:     session.token_id,
        tx_hash:      session.tx_hash,
        status:       'ACTIVE',
      })
    }

    // Get KYC jurisdiction from kyc_case table
    const kycResult = await db.query(
      `SELECT jurisdiction_code FROM onboarding_session WHERE session_id = $1`,
      [session_id]
    )

    // Compute identity_binding (same formula as wallet/bind)
    const { createHash } = await import('crypto')
    const identity_binding = createHash('sha256')
      .update(`${session.kyc_case_id}:${session.wallet_address.toLowerCase()}`)
      .digest('hex')

    logger.info({ session_id, action: 'mint_starting' }, 'Initiating mint-and-activate')

    const mintResult = await mintAndActivate({
      holder_address:    session.wallet_address,
      identity_binding:  identity_binding,
      jurisdiction_code: 'US', // TODO: pull from kyc_case.jurisdiction_code
      network_id:        'polygon',
      claims_version:    1,
    })

    // Write to credential_state_mirror (Store 2)
    await db.query(
      `INSERT INTO credential_state_mirror
         (token_id, network_id, identity_binding, status, compliance_status,
          jurisdiction_code, permission_tier, claims_version,
          issued_at, activated_at, updated_at, audit_root_hash, last_sync_block, chain_id)
       VALUES ($1,$2,$3,'ACTIVE','VERIFIED',$4,'VIEWER',1,now(),now(),now(),$5,$6,$7)
       ON CONFLICT (token_id) DO NOTHING`,
      [
        mintResult.token_id,
        mintResult.network_id,
        '0x' + identity_binding,
        'US',
        '0x' + createHash('sha256').update(identity_binding).digest('hex'),
        mintResult.block_number,
        process.env.CHAIN_ID_MUMBAI ?? 80001,
      ]
    )

    // Update session
    await db.query(
      `UPDATE onboarding_session
       SET gate4_passed = true, token_id = $1, tx_hash = $2,
           credential_status = 'ACTIVE', activated_at = now(),
           current_gate = 5, updated_at = now()
       WHERE session_id = $3`,
      [mintResult.token_id, mintResult.tx_hash, session_id]
    )

    await createAuditEvent({
      actor_type:  'SERVICE',
      actor_id:    'token.mint',
      action:      'token.minted_and_activated',
      object_type: 'TCTCredential',
      object_id:   session_id,
      metadata:    {
        token_id:      mintResult.token_id,
        tx_hash:       mintResult.tx_hash,
        block_number:  mintResult.block_number,
        finality_state: mintResult.finality_state,
        wallet:        session.wallet_address,
      },
    })

    logger.info({ session_id, token_id: mintResult.token_id, action: 'minted' }, 'Credential minted and activated')

    // TCA Option B: fire engagement.approved event (best-effort — non-blocking)
    if (session.tca_engagement_id) {
      emitEngagementEvent(
        buildEngagementEvent('engagement.approved', session.tca_engagement_id, session_id, {
          token_id:      mintResult.token_id,
          tx_hash:       mintResult.tx_hash,
          block_number:  mintResult.block_number,
          credential_class: '0x0001',
        })
      ).catch(err => logger.error({ err }, 'TCA engagement.approved event failed (non-blocking)'))
    }

    return res.status(200).json({
      gate4_passed:   true,
      token_id:       mintResult.token_id,
      tx_hash:        mintResult.tx_hash,
      status:         'ACTIVE',
      finality_state: mintResult.finality_state,
      network:        'Polygon PoS',
    })

  } catch (err) {
    logger.error({ err }, 'token/mint-and-activate error')
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: String(err) })
  }
})

/**
 * GET /api/v1/token/confirmation/:tx_hash
 * Portal polls this for block confirmation progress (Gate 4 display).
 */
tokenRouter.get('/confirmation/:tx_hash', async (req: Request, res: Response) => {
  try {
    const confirmations = await getBlockConfirmations(req.params.tx_hash)
    return res.status(200).json({
      tx_hash:        req.params.tx_hash,
      confirmations,
      finality_state: getFinalityState(confirmations),
      audit_final:    confirmations >= 128,
    })
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})
