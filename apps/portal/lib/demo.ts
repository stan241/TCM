/**
 * Demo mode utilities.
 * DEMO_MODE=true: all API routes return simulated data.
 * No database, Stripe, Persona, blockchain, or wallet required.
 */

export const DEMO_MODE = process.env.DEMO_MODE === 'true'

export function demoUuid(): string {
  return 'demo-' + Math.random().toString(36).slice(2, 10) + '-' + Math.random().toString(36).slice(2, 10)
}

/** Simulated credential for Gate 5 / Dashboard */
export const DEMO_CREDENTIAL = {
  token_id:          'demo-token-0001',
  status:            'ACTIVE',
  permission_tier:   'VIEWER',
  jurisdiction_code: 'US',
  network_id:        'polygon',
  activated_at:      new Date().toISOString(),
  claims_version:    1,
  credential_class:  '0x0001',
}

/** Simulated activity log */
export const DEMO_ACTIVITY = [
  { action: 'onboarding.session_created',     event_time: new Date(Date.now() - 5 * 60000).toISOString() },
  { action: 'onboarding.gate1_passed',         event_time: new Date(Date.now() - 4 * 60000).toISOString() },
  { action: 'kyc.verified',                    event_time: new Date(Date.now() - 3 * 60000).toISOString() },
  { action: 'wallet.bound',                    event_time: new Date(Date.now() - 2 * 60000).toISOString() },
  { action: 'token.minted_and_activated',      event_time: new Date(Date.now() - 1 * 60000).toISOString() },
  { action: 'credential.audit_final_confirmed', event_time: new Date(Date.now() - 30000).toISOString() },
]

/**
 * Simulate block confirmation progress.
 * tx_hash format in demo: "demotx_{timestamp_ms}"
 * Returns 1 block per 250ms → reaches 128 blocks (AUDIT_FINAL) in ~32 seconds.
 */
export function demoConfirmations(txHash: string): {
  confirmations: number
  finality_state: 'PROVISIONAL' | 'SOFT_FINAL' | 'OPERATIONAL_FINAL' | 'AUDIT_FINAL'
  audit_final: boolean
} {
  const parts   = txHash.split('_')
  const lastPart = parts[parts.length - 1]
  const startMs = parts.length >= 2 && lastPart ? parseInt(lastPart, 10) : Date.now()
  const elapsed  = isNaN(startMs) ? 0 : Date.now() - startMs
  const confirmations = Math.min(128, Math.floor(elapsed / 250))

  let finality_state: 'PROVISIONAL' | 'SOFT_FINAL' | 'OPERATIONAL_FINAL' | 'AUDIT_FINAL' = 'PROVISIONAL'
  if (confirmations >= 128) finality_state = 'AUDIT_FINAL'
  else if (confirmations >= 64) finality_state = 'OPERATIONAL_FINAL'
  else if (confirmations >= 32) finality_state = 'SOFT_FINAL'

  return { confirmations, finality_state, audit_final: confirmations >= 128 }
}
