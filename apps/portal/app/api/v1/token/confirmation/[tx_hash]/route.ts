import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tx_hash: string }> }) {
  try {
    const { tx_hash } = await params
    const upstream = await fetch(`${API_BASE}/api/v1/token/confirmation/${tx_hash}`)
    const data     = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
