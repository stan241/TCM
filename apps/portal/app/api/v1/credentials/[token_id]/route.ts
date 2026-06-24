import { NextRequest, NextResponse } from 'next/server'
import { DEMO_MODE, DEMO_CREDENTIAL } from '@/lib/demo'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token_id: string }> }) {
  const { token_id } = await params

  if (DEMO_MODE || token_id === 'demo-token-0001') {
    return NextResponse.json({ ...DEMO_CREDENTIAL, token_id })
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/v1/credentials/${token_id}`)
    const data     = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
