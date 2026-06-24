import { NextRequest, NextResponse } from 'next/server'
import { DEMO_MODE, demoUuid } from '@/lib/demo'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json({ case_id: `demo-kyc-${demoUuid()}`, status: 'PENDING' })
  }
  try {
    const body = await req.json()
    const upstream = await fetch(`${API_BASE}/api/v1/kyc/initiate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
