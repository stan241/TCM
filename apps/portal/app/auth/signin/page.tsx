'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import Link from 'next/link'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export default function SignInPage() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (DEMO_MODE) {
      const result = await signIn('credentials', { email, callbackUrl: '/dashboard', redirect: false })
      if (result?.error) setError('Sign-in failed. Please try again.')
      else window.location.href = result?.url ?? '/dashboard'
    } else {
      await signIn('email', { email, callbackUrl: '/dashboard', redirect: false })
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#0C1B2E]">Check your inbox</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            We sent a secure sign-in link to <span className="font-semibold text-slate-700">{email}</span>.
            Click the link to access your application.
          </p>
          <p className="text-xs text-slate-400">Link expires in 10 minutes · Check your spam folder if not received</p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      {DEMO_MODE && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-2">
          <span className="font-semibold">Demo mode active</span> — enter any email to sign in instantly.
        </div>
      )}

      <div className="mb-7">
        <h1 className="text-2xl font-bold text-[#0C1B2E] mb-1.5">
          {DEMO_MODE ? 'Sign in to demo' : 'Access your application'}
        </h1>
        <p className="text-sm text-slate-500">
          {DEMO_MODE
            ? 'Enter any email address to explore the portal.'
            : 'Enter the email address you used when you started.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={DEMO_MODE ? 'demo@example.com' : 'you@example.com'}
            required
            className="input-field"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-4 text-base">
          {loading
            ? <span className="flex items-center gap-2"><Spinner /> Signing in…</span>
            : DEMO_MODE ? 'Enter Demo Portal →' : 'Send Secure Sign-In Link →'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100">
        <p className="text-xs text-center text-slate-400">
          New applicant?{' '}
          <Link href="/onboarding" className="text-[#1A3A5C] font-semibold hover:underline">
            Begin your credential application
          </Link>
        </p>
      </div>

      {/* Trust signals */}
      <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-slate-300">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          256-bit TLS
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          No passwords
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
          Passwordless
        </span>
      </div>
    </AuthShell>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Top bar */}
      <div className="bg-[#0C1B2E] text-white/50 text-xs text-center py-2 px-4 font-medium">
        TokenCap Token is a credential, not a financial instrument.
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="w-10 h-10 bg-[#1A3A5C] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">TC</span>
            </div>
            <div>
              <p className="font-bold text-[#0C1B2E] text-lg leading-none">TokenCap</p>
              <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Network Portal</p>
            </div>
          </div>

          {/* Card */}
          <div className="card p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
