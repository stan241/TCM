'use client'

/**
 * Gate 1 — Purchase
 *
 * Stripe Elements embedded checkout.  On success the portal calls
 * /api/v1/onboarding/gate1/confirm which advances the session state and
 * unlocks Gate 2.
 *
 * Regulatory copy rules (Doc10 §IV):
 * - No language describing TCT as investment, asset, or tradable token
 * - "Purchasing gives you TCT Owner status"
 */

import { useState, useEffect }                                        from 'react'
import { useRouter }                                                   from 'next/navigation'
import { loadStripe }                                                  from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements }           from '@stripe/react-stripe-js'
import { GateProgress }                                                from '@/components/gates/GateProgress'
import { ApiError }                                                    from '@/lib/apiClient'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

export default function Gate1Page() {
  const router = useRouter()

  const [sessionId,    setSessionId]    = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [amount,       setAmount]       = useState<number>(50000)
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    const sid = sessionStorage.getItem('tcm_session_id')
    if (!sid) { router.replace('/onboarding'); return }
    setSessionId(sid)

    fetch('/api/v1/onboarding/gate1/intent', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: sid }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setClientSecret(d.client_secret)
        setAmount(d.amount_cents ?? 50000)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <LoadingScreen />

  if (error || !stripePromise || !clientSecret) {
    return <DevFallback sessionId={sessionId} error={error} />
  }

  return (
    <main className="min-h-screen bg-tcm-light-grey flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border max-w-lg w-full p-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-tcm-blue">Purchase your credential</h1>
          <p className="text-sm text-tcm-grey mt-1">
            Review your order and complete payment to proceed to identity verification.
          </p>
        </div>

        <GateProgress currentGate={1} />

        {/* Order summary */}
        <div className="border rounded-xl divide-y text-sm">
          <div className="p-4 flex justify-between">
            <div>
              <p className="font-medium">TokenCap Token credential</p>
              <p className="text-xs text-tcm-grey mt-0.5">Credential Class 0x0001 · Polygon PoS</p>
            </div>
            <span className="font-semibold">${(amount / 100).toFixed(2)}</span>
          </div>
          <div className="p-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>${(amount / 100).toFixed(2)} USD</span>
          </div>
        </div>

        {/* Regulatory notice */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
          Purchasing gives you TCT Owner status. Activating your credential after identity
          verification qualifies you for network participation.{' '}
          <strong>TokenCap Token is a credential, not a financial instrument.</strong>
        </div>

        {/* Stripe Elements */}
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'flat' } }}>
          <CheckoutForm sessionId={sessionId!} />
        </Elements>

        <p className="text-xs text-center text-tcm-grey">
          Payment processed securely by Stripe. Your credential is issued after identity verification.
        </p>
      </div>
    </main>
  )
}

function CheckoutForm({ sessionId }: { sessionId: string }) {
  const router   = useRouter()
  const stripe   = useStripe()
  const elements = useElements()

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        const res  = await fetch('/api/v1/onboarding/gate1/confirm', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ session_id: sessionId, payment_intent_id: paymentIntent.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Confirmation failed')
        router.push('/onboarding/gate-2')
      } catch (err: any) {
        setError(err.message)
        setSubmitting(false)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full bg-tcm-blue text-white font-semibold py-3 rounded-xl
                   hover:bg-tcm-blue-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Processing…' : 'Pay & Continue to KYC →'}
      </button>
    </form>
  )
}

/** Shown in dev when Stripe key is not configured — uses old dev-payment stub */
function DevFallback({ sessionId, error }: { sessionId: string | null; error: string | null }) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState<string | null>(error)

  async function devConfirm() {
    if (!sessionId) return
    setLoading(true)
    const res  = await fetch('/api/v1/onboarding/gate1/confirm', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: sessionId, payment_intent_id: `dev_${Date.now()}` }),
    })
    const data = await res.json()
    if (res.ok) { router.push('/onboarding/gate-2') }
    else        { setErr(data.error); setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-tcm-light-grey flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border max-w-lg w-full p-8 space-y-6">
        <h1 className="text-xl font-bold text-tcm-blue">Gate 1 — Payment</h1>
        <GateProgress currentGate={1} />

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <strong>Dev mode:</strong> Stripe key not configured.{' '}
          Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and <code>STRIPE_SECRET_KEY</code> to enable real payments.
        </div>

        <div className="border rounded-xl divide-y text-sm">
          <div className="p-4 flex justify-between">
            <span>TokenCap Token credential</span>
            <span className="font-semibold">$500.00</span>
          </div>
          <div className="p-4 flex justify-between font-semibold">
            <span>Total</span><span>$500.00 USD</span>
          </div>
        </div>

        {err && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">{err}</div>}

        <button
          onClick={devConfirm}
          disabled={loading}
          className="w-full bg-tcm-blue text-white font-semibold py-3 rounded-xl hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Confirming…' : '[DEV] Skip payment → Gate 2'}
        </button>

        <p className="text-xs text-center text-tcm-grey">
          TokenCap Token is a credential, not a financial instrument.
        </p>
      </div>
    </main>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-tcm-blue border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-tcm-grey">Loading payment form…</p>
      </div>
    </div>
  )
}
