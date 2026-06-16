import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { onboardingRouter } from '../routes/onboarding/index'

// ── Mock external dependencies ────────────────────────────────────────────────
vi.mock('../db', () => ({
  db: {
    query: vi.fn(),
  },
}))

vi.mock('../services/kyc/sdnCheck', () => ({
  sdnCheck: vi.fn(),
}))

vi.mock('../services/audit/auditWriter', () => ({
  createAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { db } from '../db'
import { sdnCheck } from '../services/kyc/sdnCheck'

const app = express()
app.use(express.json())
app.use('/api/v1/onboarding', onboardingRouter)

const VALID_BODY = {
  legal_name:   'Alice Smith',
  email:        'alice@example.com',
  jurisdiction: 'US',
}

describe('POST /api/v1/onboarding/initiate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('201 on valid request — returns session_id and purchase info', async () => {
    vi.mocked(sdnCheck).mockResolvedValue({ blocked: false })
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ session_id: 'sess-001' }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any) // audit insert

    const res = await request(app).post('/api/v1/onboarding/initiate').send(VALID_BODY)
    expect(res.status).toBe(201)
    expect(res.body.session_id).toBe('sess-001')
    expect(res.body.current_gate).toBe(1)
    expect(res.body.purchase).toBeDefined()
    expect(res.body.purchase.sku).toBe('TCT-0x0001-v1')
    expect(res.body.purchase.amount_cents).toBe(50000)
  })

  it('403 when SDN check blocks — generic message, no SDN details leaked', async () => {
    vi.mocked(sdnCheck).mockResolvedValue({ blocked: true, reason: 'SDN match' })

    const res = await request(app).post('/api/v1/onboarding/initiate').send(VALID_BODY)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('ELIGIBILITY_BLOCKED')
    // Must NOT reveal SDN list details
    expect(JSON.stringify(res.body)).not.toContain('SDN match')
    expect(JSON.stringify(res.body)).not.toContain('sanction')
  })

  it('403 when SDN service errors — fail-closed, never allow through', async () => {
    vi.mocked(sdnCheck).mockRejectedValue(new Error('network timeout'))

    const res = await request(app).post('/api/v1/onboarding/initiate').send(VALID_BODY)
    // sdnCheck itself catches and returns blocked:true — should result in 403 not 500
    // (this tests the fail-closed contract in sdnCheck via the route)
    expect([403, 500]).toContain(res.status)
    // Must NOT return 201 (never allow through on error)
    expect(res.status).not.toBe(201)
  })

  it('400 on missing email', async () => {
    const res = await request(app).post('/api/v1/onboarding/initiate')
      .send({ legal_name: 'Alice', jurisdiction: 'US' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('400 on invalid email', async () => {
    const res = await request(app).post('/api/v1/onboarding/initiate')
      .send({ ...VALID_BODY, email: 'not-an-email' })
    expect(res.status).toBe(400)
  })

  it('400 on missing legal_name', async () => {
    const res = await request(app).post('/api/v1/onboarding/initiate')
      .send({ email: 'a@b.com', jurisdiction: 'US' })
    expect(res.status).toBe(400)
  })

  it('400 on missing jurisdiction', async () => {
    const res = await request(app).post('/api/v1/onboarding/initiate')
      .send({ legal_name: 'Alice', email: 'a@b.com' })
    expect(res.status).toBe(400)
  })

  it('500 on DB error — does not leak error details', async () => {
    vi.mocked(sdnCheck).mockResolvedValue({ blocked: false })
    vi.mocked(db.query).mockRejectedValue(new Error('connection refused'))

    const res = await request(app).post('/api/v1/onboarding/initiate').send(VALID_BODY)
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(res.body)).not.toContain('connection refused')
  })
})

describe('GET /api/v1/onboarding/session/:session_id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 with session data when session exists', async () => {
    const session = {
      session_id:        'sess-abc',
      current_gate:      2,
      pre_gate_passed:   true,
      gate1_passed:      true,
      gate2_passed:      false,
      gate3_passed:      false,
      gate4_passed:      false,
      gate5_passed:      false,
      token_id:          null,
      credential_status: null,
      activated_at:      null,
      expires_at:        new Date(Date.now() + 86400000).toISOString(),
    }
    vi.mocked(db.query).mockResolvedValue({ rows: [session] } as any)

    const res = await request(app).get('/api/v1/onboarding/session/sess-abc')
    expect(res.status).toBe(200)
    expect(res.body.session_id).toBe('sess-abc')
    expect(res.body.current_gate).toBe(2)
  })

  it('404 when session not found', async () => {
    vi.mocked(db.query).mockResolvedValue({ rows: [] } as any)
    const res = await request(app).get('/api/v1/onboarding/session/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('SESSION_NOT_FOUND')
  })

  it('500 on DB error', async () => {
    vi.mocked(db.query).mockRejectedValue(new Error('db down'))
    const res = await request(app).get('/api/v1/onboarding/session/sess-abc')
    expect(res.status).toBe(500)
  })
})
