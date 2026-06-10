/**
 * POST /api/v1/onboarding/initiate — Next.js App Router proxy to backend API
 *
 * Portal Next.js → Node.js API (packages/api)
 * This route proxies to the backend so the portal doesn't need a separate
 * CORS setup during development. In production, requests go directly to
 * the API service behind the load balancer.
 */

import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const upstream = await fetch(`${API_BASE}/api/v1/onboarding/initiate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })

  } catch (err) {
    console.error('[api/v1/onboarding/initiate]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
