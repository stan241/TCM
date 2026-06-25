'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { onboarding, ApiError } from '@/lib/apiClient'
import { GateProgress } from '@/components/gates/GateProgress'
import { OnboardingShell, Spinner } from '@/components/layout/OnboardingShell'
import Link from 'next/link'

export default function PreGatePage() {
  const router = useRouter()
  const [fields, setFields] = useState({ legal_name: '', email: '', jurisdiction: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await onboarding.initiate(fields)
      sessionStorage.setItem('tcm_session_id', res.session_id)
      sessionStorage.setItem('tcm_purchase',   JSON.stringify(res.purchase))
      router.push('/onboarding/gate-1')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) setError('We are unable to process this application. Please contact support if you believe this is an error.')
        else if (err.status === 400) setError('Please check your information and try again.')
        else setError('Something went wrong. Please try again in a moment.')
      } else {
        setError('Connection error. Please check your internet and try again.')
      }
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFields(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <OnboardingShell>
      <GateProgress currentGate={0} />

      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-bold text-[#0C1B2E] mb-1">Apply for your credential</h1>
        <p className="text-sm text-slate-500">Provide your details below. A sanctions check will be performed before payment is collected.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 mb-5">
          <strong className="font-semibold">Unable to proceed</strong> — {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="legal_name" className="label">Legal name</label>
          <input id="legal_name" name="legal_name" type="text" placeholder="As it appears on your government-issued ID" value={fields.legal_name} onChange={handleChange} required className="input-field" />
        </div>
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" value={fields.email} onChange={handleChange} required className="input-field" />
        </div>
        <div>
          <label htmlFor="jurisdiction" className="label">Country / Jurisdiction</label>
          <select id="jurisdiction" name="jurisdiction" value={fields.jurisdiction} onChange={handleChange} required className="input-field bg-white">
            <option value="">Select your country</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="SG">Singapore</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex justify-between text-sm font-semibold text-[#0C1B2E]">
            <span>TokenCap Token credential</span>
            <span>$500.00 USD</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            A one-time credential purchase. Payment is collected only after successful sanctions screening.
            Purchasing gives you TCT Owner status and qualifies you for network participation upon activation.
          </p>
          <div className="border-t border-slate-200 pt-3 flex items-center gap-2 text-xs text-[#1A3A5C] font-semibold">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            TokenCap Token is a credential, not a financial instrument.
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-4 text-base">
          {loading
            ? <span className="flex items-center gap-2"><Spinner />Checking eligibility...</span>
            : 'Continue to Purchase'}
        </button>
      </form>

      <p className="text-xs text-center text-slate-400 mt-6">
        Already started?{' '}
        <Link href="/auth/signin" className="text-[#1A3A5C] font-semibold hover:underline">Resume your application</Link>
      </p>
    </OnboardingShell>
  )
}
