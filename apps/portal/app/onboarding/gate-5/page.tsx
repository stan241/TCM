'use client'

/**
 * Gate 5 — Confirmation
 *
 * Doc10 §III Gate 5:
 * - Credential is active. isAuthorized = true on-chain and in mirror.
 * - Fetches live credential data from GET /api/v1/credentials/:token_id
 * - Marks gate5_passed = true
 * - Celebration moment: "Your TokenCap Token is active. You are now a TCT Owner."
 * - Shows token_id, status (ACTIVE), jurisdiction_code, network, permission_tier
 * - Link to dashboard
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { credentials as credApi } from '@/lib/apiClient'
import { GateProgress } from '@/components/gates/GateProgress'

export default function Gate5ConfirmPage() {
  const router = useRouter()
  const [credential, setCredential] = useState<any>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const tokenId = sessionStorage.getItem('tcm_token_id')
    if (!tokenId) { setLoading(false); return }

    credApi.get(tokenId)
      .then(c => { setCredential(c); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-tcm-light-grey">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-md p-8 space-y-6">

        <GateProgress currentGate={5} />

        {/* Celebration */}
        <div className="text-center space-y-3 py-4">
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold text-tcm-green">Your TokenCap Token is active.</h1>
          <p className="text-sm text-tcm-grey">
            You are now a TCT Owner. Your credential grants you access to the network
            at the <strong>Viewer</strong> permission tier.
          </p>
        </div>

        {/* Live credential card */}
        <div className="rounded-lg border bg-tcm-light-grey divide-y text-sm">
          {loading ? (
            <div className="p-4 text-center text-tcm-grey text-sm animate-pulse">Loading credential…</div>
          ) : credential ? (
            <>
              <CredRow label="Status"          value={credential.status}            highlight />
              <CredRow label="Token ID"         value={credential.token_id}          mono />
              <CredRow label="Network"          value="Polygon PoS" />
              <CredRow label="Jurisdiction"     value={credential.jurisdiction_code} />
              <CredRow label="Permission tier"  value={credential.permission_tier ?? 'VIEWER'} />
              <CredRow label="Activated"        value={credential.activated_at
                ? new Date(credential.activated_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
                : '—'} />
            </>
          ) : (
            <div className="p-4 text-sm text-tcm-grey">Credential data unavailable — check your dashboard.</div>
          )}
        </div>

        {/* Regulatory disclaimer — always visible */}
        <p className="text-xs text-center text-tcm-blue font-medium border-t pt-4">
          TokenCap Token is a credential, not a financial instrument.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-tcm-blue text-white rounded py-2.5 text-sm font-semibold hover:opacity-90"
        >
          Go to your dashboard →
        </button>
      </div>
    </main>
  )
}

function CredRow({ label, value, highlight, mono }: {
  label: string; value: string; highlight?: boolean; mono?: boolean
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-tcm-grey">{label}</span>
      <span className={[
        mono      ? 'font-mono text-xs'     : 'font-medium',
        highlight ? 'text-tcm-green'        : '',
      ].join(' ')}>
        {value}
      </span>
    </div>
  )
}
