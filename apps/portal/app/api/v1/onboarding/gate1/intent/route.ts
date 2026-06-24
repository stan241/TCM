/**
 * POST /api/v1/onboarding/gate1/intent
 * Creates a Stripe PaymentIntent and returns the client_secret to the browser.
 * The actual amount is derived from the TCM commercial DB — never trust client-sent amounts.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { DEMO_MODE } from '@/lib/demo'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' })
const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json({ client_secret: null, amount_cents: 50000 })
  }
  try {
    const { session_id } = await req.json()
    if (!session_id) {
      return NextResponse.json({ error: 'MISSING_SESSION_ID' }, { status: 400 })
    }

    // Fetch purchase details from TCM API (canonical source of truth for amount)
    const sessionRes = await fetch(`${API_BASE}/api/v1/onboarding/session/${session_id}`)
    if (!sessionRes.ok) {
      return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 })
    }
    const session = await sessionRes.json()
    const amount  = session.purchase?.amount_cents ?? 50000   // default $500.00 if not set

    // Create Stripe PaymentIntent server-side
    const intent = await stripe.paymentIntents.create({
      amount,
      currency:            'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { tcm_session_id: session_id },
      description: 'TokenCap Token Annual Credential',
    })

    return NextResponse.json({
      client_secret: intent.client_secret,
      amount_cents:  amount,
    })
  } catch (err: any) {
    console.error('Gate1 intent error:', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
