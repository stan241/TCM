import { NextRequest, NextResponse } from 'next/server'
import { DEMO_MODE } from '@/lib/demo'
import { createHash } from 'crypto'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (DEMO_MODE) {
    const addr   = (body.wallet_address ?? '0xDEMO000000000000000000000000000000000001').toLowerCase()
    const binding = createHash('sha256').update(`demo:${addr}`).digest('hex')
    return NextResponse.json({ gate3_passed: true, identity_binding: binding })
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/v1/wallet/bind`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
