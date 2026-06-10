import { NextRequest, NextResponse } from 'next/server'

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token_id: string }> }) {
  const { token_id } = await params
  const body = await req.json()
  const res  = await fetch(`${API}/api/v1/credentials/${token_id}/suspend`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
