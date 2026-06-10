import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json()
    const upstream = await fetch(`${API_BASE}/api/v1/token/mint-and-activate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
