import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token_id: string }> }) {
  try {
    const { token_id } = await params
    const upstream = await fetch(`${API_BASE}/api/v1/credentials/${token_id}`)
    const data     = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
