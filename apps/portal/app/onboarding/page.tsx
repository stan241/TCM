'use client'

/**
 * Pre-gate: intake form + purchase confirmation + pre-purchase SDN check
 *
 * Doc10 §III:
 * - Creates onboarding session via POST /api/v1/onboarding/initiate
 * - Pre-purchase SDN/sanctions check fires server-side before this resolves
 * - Buyer blocked BEFORE payment collected if SDN hit (non-waivable)
 * - No credential-class selection — single class 0x0001 in v1
 * - Progressive form. Auto-save state. Resume on re-visit.
 *
 * Regulatory copy rules (Doc10 §IV):
 * - No language describing TCT as investment, asset, financial instrument
 * - Disclaimer visible on all screens
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { onboarding, ApiError } from '@/lib/apiClient'
import { GateProgress } from '@/components/gates/GateProgress'

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
      // Persist session_id in sessionStorage for gate progression
      // (no sensitive data — session_id is a non-sensitive UUID)
      sessionStorage.setItem('tcm_session_id', res.session_id)
      sessionStorage.setItem('tcm_purchase',   JSON.stringify(res.purchase))
      router.push('/onboarding/gate-1')

    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          // SDN block — generic message, do not reveal details (Doc2 §II)
          setError('We are unable to process this application. Please contact support if you believe this is an error.')
        } else if (err.status === 400) {
          setError('Please check your information and try again.')
        } else {
          setError('Something went wrong. Please try again in a moment.')
        }
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
    <main className="min-h-screen flex items-center justify-center p-6 bg-tcm-light-grey">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-md p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-tcm-blue">Get your TokenCap Token</h1>
          <p className="text-sm text-tcm-grey mt-1">
            Complete the steps below to receive your credential and access the network.
          </p>
        </div>

        <GateProgress currentGate={0} />

        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm p-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Legal name"
            name="legal_name"
            type="text"
            placeholder="As it appears on your government-issued ID"
            value={fields.legal_name}
            onChange={handleChange}
            required
          />
          <FormField
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={fields.email}
            onChange={handleChange}
            required
          />
          <div>
            <label className="block text-sm font-medium mb-1">Country / Jurisdiction</label>
            <select
              name="jurisdiction"
              value={fields.jurisdiction}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2 text-sm bg-white"
            >
              <option value="">Select your country</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="SG">Singapore</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Purchase price display — exact copy from Doc10 §III Gate 1 */}
          <div className="rounded bg-tcm-light-grey border p-4 text-sm space-y-2">
            <div className="flex justify-between font-semibold">
              <span>TokenCap Token credential</span>
              <span>$500.00</span>
            </div>
            <p className="text-xs text-tcm-grey leading-relaxed">
              You are purchasing a TokenCap Token credential. Purchasing gives you TCT Owner status.
              Activating your credential (after identity verification) qualifies you for network
              participation.
            </p>
            {/* Regulatory disclaimer — always visible (Doc10 §IV) */}
            <p className="text-xs font-medium text-tcm-blue border-t pt-2">
              TokenCap Token is a credential, not a financial instrument.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-tcm-blue text-white rounded py-2.5 text-sm font-semibold
                       hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? 'Checking eligibility…' : 'Continue to purchase →'}
          </button>
        </form>

        <p className="text-xs text-center text-tcm-grey">
          Already started?{' '}
          <a href="/auth/signin" className="underline">Resume your application</a>
        </p>
      </div>
    </main>
  )
}

function FormField({
  label, name, type, placeholder, value, onChange, required,
}: {
  label: string; name: string; type: string; placeholder: string
  value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; required: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium mb-1">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tcm-blue"
        aria-label={label}
      />
    </div>
  )
}
