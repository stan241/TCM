'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { credentials as credApi } from '@/lib/apiClient'
import { DEMO_ACTIVITY } from '@/lib/demo'
import Link from 'next/link'

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
      credApi.get(tokenId).then(cred => { setCredential(cred); setActivity(DEMO_ACTIVITY) }).catch(console.error).finally(() => setLoading(false))
      return
    }
    Promise.all([credApi.get(tokenId), credApi.getActivity(tokenId)]).then(([cred, act]) => { setCredential(cred); setActivity(act) }).catch(console.error).finally(() => setLoading(false))
  }, [status, router])

  if (status === 'loading' || loading) return <LoadingScreen />

  return (
    <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0C1B2E]">Participant Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">{session?.user?.email ?? 'Demo participant'} · TokenCap Network</p>
        </div>
        {!credential && <Link href="/onboarding" className="btn-primary">Begin Application</Link>}
      </div>
      {credential ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard label="Credential Status" value={credential.status} sub="On-chain · Polygon PoS" highlight={credential.status === 'ACTIVE'} />
            <StatCard label="Permission Tier" value={credential.permission_tier ?? 'VIEWER'} sub="Network access level" />
            <StatCard label="Jurisdiction" value={credential.jurisdiction_code ?? '—'} sub="Verified country" />
            <StatCard label="Activated" value={credential.activated_at ? new Date(credential.activated_at).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : 'Pending'} sub="128-block Audit Final" />
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2"><CredentialCard credential={credential} /></div>
            <div><NetworkAccessCard credential={credential} /></div>
          </div>
          {activity.length > 0 && <ActivityLog entries={activity} />}
        </>
      ) : (
        <EmptyState />
      )}
    </main>
  )
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase mb-2">{label}</p>
      <p className={`text-xl font-bold mb-0.5 ${highlight ? 'text-emerald-600' : 'text-[#0C1B2E]'}`}>{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  )
}

function CredentialCard({ credential }: { credential: any }) {
  const sc: Record<string, {bg: string; text: string; dot: string}> = {
    ACTIVE:    {bg:'bg-emerald-50', text:'text-emerald-700', dot:'bg-emerald-500'},
    SUSPENDED: {bg:'bg-amber-50',   text:'text-amber-700',   dot:'bg-amber-500'},
    REVOKED:   {bg:'bg-red-50',     text:'text-red-700',     dot:'bg-red-500'},
  }
  const s = sc[credential.status] ?? {bg:'bg-slate-50', text:'text-slate-600', dot:'bg-slate-400'}
  return (
    <div className="card overflow-hidden">
      <div className="bg-[#1A3A5C] px-7 py-5 flex justify-between items-start">
        <div>
          <p className="text-white/50 text-[11px] font-semibold tracking-widest uppercase mb-1">Credential</p>
          <h2 className="text-white font-bold text-lg">TokenCap Token</h2>
          <p className="text-white/40 font-mono text-xs mt-1">{credential.token_id}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{credential.status}
        </div>
      </div>
      <div className="p-7 grid grid-cols-2 md:grid-cols-3 gap-4">
        <Detail label="Network" value="Polygon PoS" />
        <Detail label="Chain ID" value="137" />
        <Detail label="Standard" value="ERC-1155 + ERC-5192" />
        <Detail label="Jurisdiction" value={credential.jurisdiction_code ?? '—'} />
        <Detail label="Permission" value={credential.permission_tier ?? 'VIEWER'} />
        <Detail label="Class" value="0x0001" />
      </div>
      <div className="px-7 pb-6 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">TokenCap Token is a credential, not a financial instrument. Non-transferable · Soulbound</p>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3.5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-semibold text-[#0C1B2E]">{value}</p>
    </div>
  )
}

function NetworkAccessCard({ credential }: { credential: any }) {
  const active = credential.status === 'ACTIVE'
  return (
    <div className={`card p-6 h-full flex flex-col gap-5 ${active ? 'border-emerald-200' : 'border-red-200'}`}>
      <div>
        <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase mb-3">Network Access</p>
        <div className={`flex items-center gap-3 p-4 rounded-xl ${active ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${active ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {active
              ? <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              : <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            }
          </div>
          <div>
            <p className={`font-bold text-sm ${active ? 'text-emerald-700' : 'text-red-700'}`}>{active ? 'Access Granted' : 'Access Denied'}</p>
            <p className={`text-xs mt-0.5 ${active ? 'text-emerald-600' : 'text-red-500'}`}>{active ? (credential.permission_tier ?? 'VIEWER') : credential.status}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        {['Credential verified','KYC completed','Wallet bound','Audit Final reached'].map((l: string) => (
          <div key={l} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{l}</span>
            {active ? <span className="text-emerald-500 text-xs font-semibold">Yes</span> : <span className="text-slate-300 text-xs">Pending</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityLog({ entries }: { entries: any[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-7 py-5 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-[#0C1B2E]">Activity Log</h3>
        <span className="text-xs text-slate-400">{entries.length} events</span>
      </div>
      <div className="divide-y divide-slate-100">
        {entries.slice(0, 10).map((e: any, i: number) => (
          <div key={i} className="flex items-center justify-between px-7 py-4 text-sm hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#C9A84C] rounded-full flex-shrink-0" />
              <span className="font-mono text-xs text-slate-700">{e.action}</span>
            </div>
            <span className="text-slate-400 text-xs">{new Date(e.event_time).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card p-16 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[#0C1B2E] mb-2">No active credential</h2>
      <p className="text-slate-500 text-sm mb-7 max-w-sm mx-auto">You have not yet completed the onboarding process. Begin your application to receive your TokenCap Token credential.</p>
      <Link href="/onboarding" className="btn-primary">Begin Application</Link>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-[#1A3A5C] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500">Loading your dashboard...</p>
      </div>
    </div>
  )
}
