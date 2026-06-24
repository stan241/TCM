/**
 * POST /api/v1/onboarding/initiate — Next.js App Router proxy to backend API
 *
 * Portal Next.js → Node.js API (packages/api)
 * This route proxies to the backend so the portal doesn't need a separate
 * CORS setup during development. In production, requests go directly to
 * the API service behind the load balancer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { DEMO_MODE, demoUuid } from '@/lib/demo'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  if (DEMO_MODE) {
    const { legal_name } = await req.json().catch(() => ({}))
    if (legal_name === 'BLOCKED') {
      return NextResponse.json(
        { error: 'ELIGIBILITY_BLOCKED', message: 'We are unable to process this application. Please contact support.' },
        { status: 403 }
      )
    }
    return NextResponse.json({
      session_id:      demoUuid(),
      current_gate:    1,
      pre_gate_passed: true,
      expires_at:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      purchase: { sku: 'TCT-0x0001-v1', amount_cents: 50000, currency: 'USD', description: 'TokenCap Token credential — Credential Class 0x0001' },
    })
  }

  try {
    const body     = await req.json()
    const upstream = await fetch(`${API_BASE}/api/v1/onboarding/initiate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (err) {
    console.error('[api/v1/onboarding/initiate]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
