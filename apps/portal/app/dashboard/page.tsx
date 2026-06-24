'use client'

/**
 * Participant Dashboard
 * Shows credential status, activity log, and network access state.
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { credentials as credApi } from '@/lib/apiClient'
import { DEMO_ACTIVITY } from '@/lib/demo'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [credential, setCredential] = useState<any>(null)
  const [activity,   setActivity]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!DEMO_MODE && status === 'unauthenticated') { router.replace('/auth/signin'); return }
    if (!DEMO_MODE && status !== 'authenticated') return

    const tokenId = sessionStorage.getItem('tcm_token_id') ?? (DEMO_MODE ? 'demo-token-0001' : null)
    if (!tokenId) { setLoading(false); return }

    if (DEMO_MODE) {
      credApi.get(tokenId)
        .then(cred => { setCredential(cred); setActivity(DEMO_ACTIVITY) })
        .catch(console.error)
        .finally(() => setLoading(false))
      return
    }

    Promise.all([
      credApi.get(tokenId),
      credApi.getActivity(tokenId),
    ])
      .then(([cred, act]) => { setCredential(cred); setActivity(act) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [status, router])

  if (status === 'loading' || loading) {
    return <LoadingScreen />
  }

  return (
    <main className="min-h-screen bg-tcm-light-grey">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-tcm-blue">TokenCap Token</h1>
          <p className="text-xs text-tcm-grey">Participant Dashboard</p>
        </div>
        <div className="text-xs text-tcm-grey">{session?.user?.email}</div>
      </nav>

      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Credential status card */}
        {credential ? (
          <CredentialCard credential={credential} />
        ) : (
          <div className="bg-white rounded-xl border p-8 text-center text-sm text-tcm-grey">
            No active credential found.{' '}
            <a href="/onboarding" className="text-tcm-blue underline">Start your application →</a>
          </div>
        )}

        {/* Network access status */}
        {credential && <NetworkAccessCard credential={credential} />}

        {/* Activity log */}
        {activity.length > 0 && <ActivityLog entries={activity} />}

      </div>
    </main>
  )
}

function CredentialCard({ credential }: { credential: any }) {
  const statusColors: Record<string, string> = {
    ACTIVE:    'bg-green-100 text-green-700',
    SUSPENDED: 'bg-yellow-100 text-yellow-700',
    REVOKED:   'bg-red-100 text-red-700',
    EXPIRED:   'bg-gray-100 text-gray-600',
    RETIRED:   'bg-gray-100 text-gray-600',
  }
  const color = statusColors[credential.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-bold text-tcm-blue">TokenCap Token Credential</h2>
          <p className="text-xs text-tcm-grey mt-0.5 font-mono">{credential.token_id}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${color}`}>
          {credential.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoRow label="Network"         value="Polygon PoS" />
        <InfoRow label="Jurisdiction"    value={credential.jurisdiction_code} />
        <InfoRow label="Permission tier" value={credential.permission_tier ?? 'VIEWER'} />
        <InfoRow label="Activated"       value={credential.activated_at
          ? new Date(credential.activated_at).toLocaleDateString()
          : '—'} />
      </div>

      <p className="text-xs text-tcm-blue border-t pt-3">
        TokenCap Token is a credential, not a financial instrument.
      </p>
    </div>
  )
}

function NetworkAccessCard({ credential }: { credential: any }) {
  const hasAccess = credential.status === 'ACTIVE'
  return (
    <div className={`rounded-xl border p-5 ${hasAccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{hasAccess ? '✅' : '🚫'}</span>
        <div>
          <p className={`font-semibold text-sm ${hasAccess ? 'text-green-700' : 'text-red-700'}`}>
            {hasAccess ? 'Network access: GRANTED' : 'Network access: DENIED'}
          </p>
          <p className="text-xs text-tcm-grey mt-0.5">
            {hasAccess
              ? `You have ${credential.permission_tier ?? 'VIEWER'} access to the TokenCap Network.`
              : `Credential status: ${credential.status}. Contact support for assistance.`}
          </p>
        </div>
      </div>
    </div>
  )
}

function ActivityLog({ entries }: { entries: any[] }) {
  return (
    <div className="bg-white rounded-xl border p-5 space-y-3">
      <h3 className="font-semibold text-sm text-tcm-blue">Recent Activity</h3>
      <div className="space-y-2">
        {entries.slice(0, 10).map((entry, i) => (
          <div key={i} className="flex justify-between text-xs text-tcm-grey border-b pb-2 last:border-0">
            <span className="font-mono">{entry.action}</span>
            <span>{new Date(entry.event_time).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-tcm-light-grey rounded p-2.5">
      <p className="text-xs text-tcm-grey">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-tcm-blue border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-tcm-grey">Loading your dashboard…</p>
      </div>
    </div>
  )
}
