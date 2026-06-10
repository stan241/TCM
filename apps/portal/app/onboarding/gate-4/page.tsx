'use client'

/**
 * Gate 4 — Mint + Activate
 *
 * Doc10 §III Gate 4 — Rev 4:
 * - Calls POST /api/v1/token/mint-and-activate
 * - Polls GET /api/v1/token/confirmation/:tx_hash every 4s
 * - Shows block progress: PROVISIONAL → SOFT_FINAL → OPERATIONAL_FINAL → AUDIT_FINAL
 * - Polygonscan link on tx submission
 * - PROVISIONAL badge until Audit Final (128 blocks, ~4.3 min on Polygon PoS)
 * - Revenue recognized only at AUDIT_FINAL (not shown to user — backend concern)
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { token as tokenApi, ApiError } from '@/lib/apiClient'
import { GateProgress } from '@/components/gates/GateProgress'

type FinalityState = 'PROVISIONAL' | 'SOFT_FINAL' | 'OPERATIONAL_FINAL' | 'AUDIT_FINAL'
type MintStep      = 'IDLE' | 'MINTING' | 'CONFIRMING' | 'DONE' | 'ERROR'

const FINALITY_BLOCKS: Record<FinalityState, number> = {
  PROVISIONAL:       0,
  SOFT_FINAL:        32,
  OPERATIONAL_FINAL: 64,
  AUDIT_FINAL:       128,
}

export default function Gate4MintPage() {
  const router = useRouter()
  const [sessionId,    setSessionId]    = useState<string | null>(null)
  const [step,         setStep]         = useState<MintStep>('IDLE')
  const [txHash,       setTxHash]       = useState<string | null>(null)
  const [tokenId,      setTokenId]      = useState<string | null>(null)
  const [confirmations, setConfirmations] = useState(0)
  const [finalityState, setFinalityState] = useState<FinalityState>('PROVISIONAL')
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    const sid = sessionStorage.getItem('tcm_session_id')
    if (!sid) { router.replace('/onboarding'); return }
    setSessionId(sid)
  }, [router])

  // Auto-start mint when page loads
  useEffect(() => {
    if (!sessionId || step !== 'IDLE') return
    startMint()
  }, [sessionId])

  async function startMint() {
    if (!sessionId) return
    setStep('MINTING')
    setError(null)

    try {
      const res = await tokenApi.mintAndActivate({ session_id: sessionId })
      setTxHash(res.tx_hash)
      setTokenId(res.token_id)
      sessionStorage.setItem('tcm_token_id', res.token_id)
      setStep('CONFIRMING')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mint failed. Please contact support.')
      setStep('ERROR')
    }
  }

  // Poll block confirmations every 4s
  const pollConfirmations = useCallback(async () => {
    if (!txHash || step !== 'CONFIRMING') return
    try {
      const res = await fetch(`/api/v1/token/confirmation/${txHash}`)
      const data = await res.json() as { confirmations: number; finality_state: FinalityState }
      setConfirmations(data.confirmations)
      setFinalityState(data.finality_state)
      if (data.finality_state === 'AUDIT_FINAL') {
        setStep('DONE')
        setTimeout(() => router.push('/onboarding/gate-5'), 1500)
      }
    } catch { /* non-fatal */ }
  }, [txHash, step, router])

  useEffect(() => {
    if (step !== 'CONFIRMING') return
    const interval = setInterval(pollConfirmations, 4000)
    return () => clearInterval(interval)
  }, [step, pollConfirmations])

  const pct = Math.min((confirmations / 128) * 100, 100)

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-tcm-light-grey">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-md p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-tcm-blue">Activating Your Credential</h1>
          <p className="text-sm text-tcm-grey mt-1">
            Your identity has been verified. We are issuing your TokenCap Token on Polygon PoS.
          </p>
        </div>

        <GateProgress currentGate={4} />

        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm p-4">
            {error}
          </div>
        )}

        {/* Minting state */}
        {step === 'MINTING' && (
          <StatusCard icon="spinner" color="blue" message="Submitting transaction to Polygon PoS…" />
        )}

        {/* Confirming state */}
        {(step === 'CONFIRMING' || step === 'DONE') && (
          <div className="space-y-4">
            {/* TX hash */}
            {txHash && (
              <div className="rounded bg-gray-50 border p-3 text-xs">
                <span className="text-tcm-grey">Transaction: </span>
                <a
                  href={`https://mumbai.polygonscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-tcm-blue underline break-all"
                >
                  {txHash.slice(0, 20)}…{txHash.slice(-8)}
                </a>
              </div>
            )}

            {/* PROVISIONAL badge */}
            {finalityState !== 'AUDIT_FINAL' && (
              <div className="rounded bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-700 inline-block">
                ⏳ PROVISIONAL — awaiting {128 - confirmations} more block confirmations
              </div>
            )}

            {/* Block progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-tcm-grey">
                <span>Block confirmations</span>
                <span>{confirmations} / 128</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-1000"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: finalityState === 'AUDIT_FINAL' ? '#1E8449' : '#1A3A5C',
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-tcm-grey">
                <span>Soft ({FINALITY_BLOCKS.SOFT_FINAL})</span>
                <span>Operational ({FINALITY_BLOCKS.OPERATIONAL_FINAL})</span>
                <span>Audit Final ({FINALITY_BLOCKS.AUDIT_FINAL})</span>
              </div>
            </div>

            {/* Finality badge */}
            <FinalityBadge state={finalityState} />
          </div>
        )}

        {/* Done */}
        {step === 'DONE' && (
          <StatusCard icon="check" color="green" message="Credential activated. Proceeding to confirmation…" />
        )}

        <p className="text-xs text-tcm-grey">
          Your credential is active once the transaction reaches Audit Final status (128 block
          confirmations, approximately 4 minutes). You may close this window and return later.
        </p>
      </div>
    </main>
  )
}

function FinalityBadge({ state }: { state: FinalityState }) {
  const configs: Record<FinalityState, { color: string; label: string }> = {
    PROVISIONAL:       { color: 'bg-gray-100 text-gray-600',    label: 'Provisional' },
    SOFT_FINAL:        { color: 'bg-blue-100 text-blue-700',    label: 'Soft Final' },
    OPERATIONAL_FINAL: { color: 'bg-yellow-100 text-yellow-700', label: 'Operational Final' },
    AUDIT_FINAL:       { color: 'bg-green-100 text-green-700',  label: '✓ Audit Final' },
  }
  const c = configs[state]
  return (
    <span className={`inline-block rounded px-3 py-1 text-xs font-medium ${c.color}`}>
      {c.label}
    </span>
  )
}

function StatusCard({ icon, color, message }: { icon: 'spinner' | 'check'; color: 'blue' | 'green'; message: string }) {
  const bg = color === 'green' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'
  return (
    <div className={`rounded border p-4 flex items-center gap-3 text-sm ${bg}`}>
      {icon === 'spinner'
        ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
        : <span className="text-xl flex-shrink-0">✓</span>
      }
      {message}
    </div>
  )
}
