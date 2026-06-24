/**
 * POST /api/v1/onboarding/gate1/confirm
 * Verifies Stripe PaymentIntent succeeded server-side, then advances gate state.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { DEMO_MODE } from '@/lib/demo'

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' })
const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json({ gate1_passed: true, order_id: 'demo-order-001', invoice_number: 'INV-DEMO-001' })
  }
  try {
    const { session_id, payment_intent_id } = await req.json()
    if (!session_id || !payment_intent_id) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    }

    // Verify payment server-side — never trust browser-reported status
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id)
    if (intent.status !== 'succeeded') {
      return NextResponse.json({ error: 'PAYMENT_NOT_SUCCEEDED', status: intent.status }, { status: 402 })
    }

    // Confirm session_id matches metadata
    if (intent.metadata.tcm_session_id !== session_id) {
      return NextResponse.json({ error: 'SESSION_MISMATCH' }, { status: 403 })
    }

    // Advance gate 1 in TCM backend
    const upstream = await fetch(`${API_BASE}/api/v1/onboarding/gate1/confirm`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id, payment_ref: payment_intent_id }),
    })
    const data = await upstream.json()

    return NextResponse.json(data, { status: upstream.status })
  } catch (err: any) {
    console.error('Gate1 confirm error:', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
