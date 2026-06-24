import { NextRequest, NextResponse } from 'next/server'
import { DEMO_MODE, demoConfirmations } from '@/lib/demo'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tx_hash: string }> }) {
  const { tx_hash } = await params

  if (DEMO_MODE || tx_hash.startsWith('demotx_')) {
    return NextResponse.json({ tx_hash, ...demoConfirmations(tx_hash) })
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/v1/token/confirmation/${tx_hash}`)
    const data     = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
