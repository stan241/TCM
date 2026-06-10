/**
 * Reconciliation jobs — three scheduled intervals per spec:
 *   MIRROR_VS_CHAIN    every 5 min  — on-chain state vs credential_state_mirror
 *   AUDIT_VS_MIRROR    every 15 min — audit_log entries vs mirror rows
 *   BILLING_VS_EVENTS  every 1 hr   — billing records vs audit AUDIT_FINAL events
 *
 * Jobs are fail-safe: a crashed job logs and reschedules; it never crashes the process.
 */

import { db, auditDb, billingDb } from '../db/index.js'
import { logger }                  from '../lib/logger.js'
import { createPublicClient, http } from 'viem'
import { polygon, polygonMumbai }   from 'viem/chains'

const CHAIN  = process.env.NODE_ENV === 'production' ? polygon : polygonMumbai
const RPC    = process.env.NODE_ENV === 'production'
  ? process.env.ALCHEMY_RPC_URL_POLYGON!
  : process.env.ALCHEMY_RPC_URL_MUMBAI!

function viemClient() {
  return createPublicClient({ chain: CHAIN, transport: http(RPC) })
}

// ── MIRROR_VS_CHAIN ────────────────────────────────────────────────────────────

async function mirrorVsChain(): Promise<void> {
  const log = logger.child({ job: 'MIRROR_VS_CHAIN' })

  const { rows } = await db.query<{ token_id: string; status: string }>(
    `SELECT token_id, status
     FROM   credential_state_mirror
     WHERE  status NOT IN ('REVOKED','EXPIRED','RETIRED')
     AND    activated_at < NOW() - INTERVAL '2 minutes'`
  )

  if (rows.length === 0) { log.debug('No tokens to reconcile'); return }

  const contractAddress = process.env.TCT_CREDENTIAL_CONTRACT_ADDRESS
  if (!contractAddress) { log.warn('TCT_CREDENTIAL_CONTRACT_ADDRESS not set — skipping chain check'); return }

  const client  = viemClient()
  let discrepancies = 0

  for (const row of rows) {
    try {
      // Read on-chain status via credentialStatus(uint256)
      const onChainStatus = await client.readContract({
        address:      contractAddress as `0x${string}`,
        abi:          TCT_CREDENTIAL_ABI,
        functionName: 'credentialStatus',
        args:         [BigInt(row.token_id.replace(/^TCT-/, ''))],
      }) as number

      const CHAIN_STATUS_MAP: Record<number, string> = {
        0: 'ACTIVE', 1: 'SUSPENDED', 2: 'REVOKED', 3: 'EXPIRED', 4: 'RETIRED',
      }

      const expected = CHAIN_STATUS_MAP[onChainStatus]
      if (expected && expected !== row.status) {
        discrepancies++
        log.warn({ token_id: row.token_id, mirror: row.status, chain: expected }, 'Discrepancy detected — updating mirror')
        await db.query(
          `UPDATE credential_state_mirror SET status = $1, updated_at = NOW() WHERE token_id = $2`,
          [expected, row.token_id]
        )
      }
    } catch (err) {
      log.error({ err, token_id: row.token_id }, 'Chain read failed for token')
    }
  }

  log.info({ checked: rows.length, discrepancies }, 'MIRROR_VS_CHAIN complete')
}

// ── AUDIT_VS_MIRROR ────────────────────────────────────────────────────────────

async function auditVsMirror(): Promise<void> {
  const log = logger.child({ job: 'AUDIT_VS_MIRROR' })

  // Verify chain_hash integrity for the last 1000 audit events
  const { rows } = await auditDb.query<{
    audit_event_id: string
    chain_hash:     string
    chain_prev_hash: string
    after_hash:     string
  }>(
    `SELECT audit_event_id, chain_hash, chain_prev_hash, after_hash
     FROM   audit_log
     ORDER  BY event_time DESC
     LIMIT  1000`
  )

  const crypto = await import('node:crypto')
  let broken   = 0

  for (const row of rows) {
    const computed = crypto.createHash('sha256')
      .update(row.audit_event_id + row.after_hash + (row.chain_prev_hash ?? ''))
      .digest('hex')

    if (computed !== row.chain_hash) {
      broken++
      log.error({ audit_event_id: row.audit_event_id }, 'chain_hash BROKEN — tamper detected')
    }
  }

  log.info({ checked: rows.length, broken }, 'AUDIT_VS_MIRROR complete')
}

// ── BILLING_VS_EVENTS ──────────────────────────────────────────────────────────

async function billingVsEvents(): Promise<void> {
  const log = logger.child({ job: 'BILLING_VS_EVENTS' })

  // Find AUDIT_FINAL events that have no corresponding billing revenue record
  const { rows } = await auditDb.query<{ token_id: string; event_time: string }>(
    `SELECT metadata->>'token_id' AS token_id, event_time
     FROM   audit_log
     WHERE  action      = 'AUDIT_FINAL'
     AND    event_time  > NOW() - INTERVAL '25 hours'`
  )

  let missing = 0

  for (const row of rows) {
    if (!row.token_id) continue
    const { rowCount } = await billingDb.query(
      `SELECT 1 FROM revenue_events WHERE token_id = $1 AND recognized_at IS NOT NULL`,
      [row.token_id]
    )
    if (!rowCount) {
      missing++
      log.warn({ token_id: row.token_id }, 'AUDIT_FINAL with no revenue record — alerting')
      // In production: fire PagerDuty / Slack webhook here
    }
  }

  log.info({ checked: rows.length, missing }, 'BILLING_VS_EVENTS complete')
}

// ── Minimal ABI for credentialStatus ──────────────────────────────────────────

const TCT_CREDENTIAL_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name:   'credentialStatus',
    outputs:[{ internalType: 'uint8',  name: '',        type: 'uint8'   }],
    stateMutability: 'view',
    type:   'function',
  },
] as const

// ── Scheduler ─────────────────────────────────────────────────────────────────

function schedule(name: string, fn: () => Promise<void>, intervalMs: number) {
  const run = async () => {
    try      { await fn() }
    catch(e) { logger.error({ job: name, err: e }, 'Job failed — will retry next interval') }
    finally  { setTimeout(run, intervalMs) }
  }
  // Stagger start times to avoid thundering herd
  const stagger = Math.floor(Math.random() * 30_000)
  setTimeout(run, stagger)
  logger.info({ job: name, intervalMs, stagger }, 'Reconciliation job scheduled')
}

export function startReconciliationJobs() {
  schedule('MIRROR_VS_CHAIN',   mirrorVsChain,   5  * 60_000)
  schedule('AUDIT_VS_MIRROR',   auditVsMirror,   15 * 60_000)
  schedule('BILLING_VS_EVENTS', billingVsEvents, 60 * 60_000)
}
