'use client'

/**
 * Gate 2 — Identity Verification (KYC)
 *
 * Doc10 §III Gate 2:
 * - Mounts Persona Embedded Flow (sandbox in dev, JPM in prod)
 * - Polls GET /api/v1/kyc/status/:case_id every 3s
 * - On VERIFIED → advance to Gate 3
 * - On FAILED / RESTRICTED → show appropriate message, do not advance
 * - KYC failure leaves credential in Pending until resolved
 *
 * Vendor-agnostic: portal always uses Persona SDK for the embedded UI.
 * JPM production: JPM provides their own embedded widget or redirect flow.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { kyc, ApiError } from '@/lib/apiClient'
import { GateProgress } from '@/components/gates/GateProgress'
import { PERSONA_POLL_INTERVAL_MS } from '@/lib/persona'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

type KYCStatus = 'IDLE' | 'INITIATING' | 'IN_PROGRESS' | 'VERIFIED' | 'FAILED' | 'RESTRICTED'

export default function Gate2KYCPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [caseId,    setCaseId]    = useState<string | null>(null)
  const [status,    setStatus]    = useState<KYCStatus>('IDLE')
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    const sid = sessionStorage.getItem('tcm_session_id')
    if (!sid) { router.replace('/onboarding'); return }
    setSessionId(sid)
  }, [router])

  // ── Step 1: Initiate KYC when page loads ────────────────────────────────────
  useEffect(() => {
    if (!sessionId || status !== 'IDLE') return

    setStatus('INITIATING')
    kyc.initiate({ session_id: sessionId })
      .then(res => {
        setCaseId(res.case_id)
        setStatus('IN_PROGRESS')
      })
      .catch(err => {
        setError(err instanceof ApiError ? err.message : 'Failed to start verification.')
        setStatus('FAILED')
      })
  }, [sessionId, status])

  // ── Step 2: Poll status every 3s ────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    if (!caseId || status !== 'IN_PROGRESS') return

    try {
      const res = await kyc.getStatus(caseId)
      if (res.status === 'VERIFIED') {
        setStatus('VERIFIED')
        setTimeout(() => router.push('/onboarding/gate-3'), 1500)
      } else if (res.status === 'FAILED') {
        setStatus('FAILED')
        setError('Identity verification was not completed. Please contact support.')
      } else if (res.status === 'RESTRICTED') {
        setStatus('RESTRICTED')
        setError('We are unable to process this application. Please contact support.')
      }
    } catch {
      // Polling errors are non-fatal — keep polling
    }
  }, [caseId, status, router])

  useEffect(() => {
    if (status !== 'IN_PROGRESS') return
    const interval = setInterval(pollStatus, PERSONA_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status, pollStatus])

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-tcm-light-grey">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-md p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-tcm-blue">Identity Verification</h1>
          <p className="text-sm text-tcm-grey mt-1">
            We are required by law to verify your identity before activating your credential.
            This typically takes 1–3 minutes.
          </p>
        </div>

        <GateProgress currentGate={2} />

        {/* Status display */}
        {status === 'INITIATING' && <StatusCard state="loading" message="Starting verification…" />}
        {status === 'VERIFIED'   && <StatusCard state="success" message="Identity verified. Proceeding to wallet setup…" />}
        {(status === 'FAILED' || status === 'RESTRICTED') && (
          <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm p-4">
            {error}
          </div>
        )}

        {/* Demo mode: skip Persona SDK, show simulated verification UI */}
        {status === 'IN_PROGRESS' && caseId && DEMO_MODE && (
          <DemoKycFlow onComplete={pollStatus} />
        )}

        {/* Persona Embedded Flow — mounts when case_id is available (live mode only) */}
        {status === 'IN_PROGRESS' && caseId && !DEMO_MODE && (
          <PersonaEmbeddedFlow
            caseId={caseId}
            onComplete={() => pollStatus()}
          />
        )}

        <div className="rounded bg-gray-50 border p-3 text-xs text-tcm-grey space-y-1">
          <p className="font-medium">What you will need:</p>
          <p>• A government-issued photo ID (passport, driver's license, or national ID)</p>
          <p>• A device with a front-facing camera for the selfie step</p>
        </div>

        <p className="text-xs text-tcm-grey">
          Your identity information is handled securely and used only for compliance
          verification. It is never shared with third parties except as required by law.
        </p>
      </div>
    </main>
  )
}

// ── Demo KYC Flow ─────────────────────────────────────────────────────────────
function DemoKycFlow({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const steps = [
      { delay: 800,  pct: 20, label: 'Scanning document…' },
      { delay: 1800, pct: 50, label: 'Verifying identity…' },
      { delay: 2800, pct: 80, label: 'Cross-referencing records…' },
      { delay: 3600, pct: 100, label: 'Verification complete' },
    ]
    const timers = steps.map(s => setTimeout(() => {
      setProgress(s.pct)
      if (s.pct === 100) setTimeout(onComplete, 400)
    }, s.delay))
    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div className="border-2 border-blue-200 rounded-xl p-6 bg-blue-50 space-y-4">
      <div className="flex items-center gap-3 text-sm text-blue-800">
        <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-xl">🪪</div>
        <div>
          <p className="font-semibold">Simulated Identity Verification</p>
          <p className="text-xs text-blue-600 mt-0.5">Demo mode — no real document required</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-blue-700">
          <span>{progress < 100 ? 'Verifying…' : 'Complete'}</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {progress < 100 && (
        <div className="grid grid-cols-3 gap-2 text-xs text-blue-600">
          {['Scan document', 'Verify identity', 'Clear records'].map((step, i) => (
            <div key={i} className={`text-center p-2 rounded border ${progress > i * 33 ? 'bg-blue-200 border-blue-300 font-medium' : 'border-blue-200'}`}>
              {step}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Persona Embedded Flow Component ─────────────────────────────────────────
function PersonaEmbeddedFlow({
  caseId,
  onComplete,
}: {
  caseId: string
  onComplete: () => void
}) {
  useEffect(() => {
    // Dynamically load Persona's SDK script
    // Persona requires their script loaded at runtime (not npm package)
    const script = document.createElement('script')
    script.src = 'https://cdn.withpersona.com/dist/persona-v4-latest.js'
    script.async = true
    script.onload = () => {
      const client = new (window as any).Persona.Client({
        inquiryId:   caseId,
        environment: 'sandbox',
        onComplete:  onComplete,
        onCancel:    () => console.log('[Persona] cancelled'),
        onError:     (err: unknown) => console.error('[Persona] error', err),
      })
      client.open()
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [caseId, onComplete])

  return (
    <div className="border-2 border-dashed border-blue-200 rounded p-8 text-center text-sm text-blue-600 bg-blue-50">
      <div className="animate-pulse">Loading identity verification…</div>
      <p className="text-xs text-tcm-grey mt-2">
        A secure verification window will open automatically.
      </p>
    </div>
  )
}

// ── Status card ──────────────────────────────────────────────────────────────
function StatusCard({ state, message }: { state: 'loading' | 'success'; message: string }) {
  return (
    <div className={`rounded p-4 flex items-center gap-3 text-sm ${
      state === 'success'
        ? 'bg-green-50 border border-green-200 text-green-700'
        : 'bg-blue-50 border border-blue-200 text-blue-700'
    }`}>
      {state === 'loading'
        ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        : <span className="text-lg">✓</span>
      }
      <span>{message}</span>
    </div>
  )
}
