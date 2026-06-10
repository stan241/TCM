'use client'

/**
 * Sign-in / Resume page — email + OTP
 * Doc10 §V: "Participant re-enters via email + OTP on resume"
 */

import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function SignInPage() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await signIn('email', { email, callbackUrl: '/dashboard', redirect: false })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center space-y-4">
          <div className="text-4xl">📧</div>
          <h1 className="text-xl font-bold text-tcm-blue">Check your email</h1>
          <p className="text-sm text-tcm-grey">
            We sent a sign-in link to <strong>{email}</strong>.
            Click the link in the email to resume your application.
          </p>
          <p className="text-xs text-tcm-grey">Link expires in 10 minutes.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 space-y-6">
        <h1 className="text-xl font-bold text-tcm-blue">Resume your application</h1>
        <p className="text-sm text-tcm-grey">
          Enter the email you used when you started. We will send you a link to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tcm-blue"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-tcm-blue text-white rounded py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
        <p className="text-xs text-center text-tcm-grey">
          New here? <a href="/onboarding" className="underline">Start your application</a>
        </p>
      </div>
    </main>
  )
}
