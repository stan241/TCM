import { NextRequest, NextResponse } from 'next/server'

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function GET(req: NextRequest) {
  const limit  = req.nextUrl.searchParams.get('limit')  ?? '50'
  const offset = req.nextUrl.searchParams.get('offset') ?? '0'
  try {
    const res  = await fetch(`${API}/api/v1/audit?limit=${limit}&offset=${offset}`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
