import { NextRequest, NextResponse } from 'next/server'
import { DEMO_MODE } from '@/lib/demo'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:4000'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ case_id: string }> }) {
  const { case_id } = await params

  if (DEMO_MODE) {
    // Demo: always VERIFIED (Persona SDK skipped entirely)
    return NextResponse.json({ status: 'VERIFIED', jurisdiction_code: 'US', case_id })
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/v1/kyc/status/${case_id}`)
    const data     = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
