import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { authRouter } from '../routes/auth/index'

// ── Mock token validator ──────────────────────────────────────────────────────
vi.mock('../services/token/validateToken', () => ({
  validateToken: vi.fn(),
}))

vi.mock('../middleware/rateLimit', () => ({
  rateLimiter: () => (_req: any, _res: any, next: any) => next(),
}))

import { validateToken } from '../services/token/validateToken'

const app = express()
app.use(express.json())
app.use('/auth/v1', authRouter)

const VALID_TOKEN_RESULT = {
  status:            'ACTIVE',
  permission_tier:   1,
  verified_at:       '2024-01-01T00:00:00Z',
  network_id:        'polygon',
  jurisdiction_code: 'US',
}

describe('POST /auth/v1/validate-token — TCM-CRED-VERIFY-002 locked schema', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 returns exactly the 5 allowed fields', async () => {
    vi.mocked(validateToken).mockResolvedValue(VALID_TOKEN_RESULT as any)

    const res = await request(app)
      .post('/auth/v1/validate-token')
      .send({ token_id: 'tok-001' })

    expect(res.status).toBe(200)
    // Exactly these 5 fields — no more
    expect(Object.keys(res.body)).toEqual([
      'status', 'permission_tier', 'verified_at', 'network_id', 'jurisdiction_code'
    ])
  })

  it('response contains NO PII fields', async () => {
    vi.mocked(validateToken).mockResolvedValue(VALID_TOKEN_RESULT as any)
    const res = await request(app)
      .post('/auth/v1/validate-token')
      .send({ token_id: 'tok-001' })

    const body = JSON.stringify(res.body)
    const piiFields = ['email', 'legal_name', 'name', 'address', 'phone',
                       'identity_binding', 'kyc_case_id', 'wallet_address']
    for (const field of piiFields) {
      expect(body).not.toContain(field)
    }
  })

  it('400 when extra fields sent — strict schema enforcement', async () => {
    const res = await request(app)
      .post('/auth/v1/validate-token')
      .send({ token_id: 'tok-001', extra_field: 'should_be_rejected' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('BAD_REQUEST')
  })

  it('400 when token_id missing', async () => {
    const res = await request(app)
      .post('/auth/v1/validate-token')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('BAD_REQUEST')
  })

  it('400 when body is empty', async () => {
    const res = await request(app)
      .post('/auth/v1/validate-token')
      .send('')
      .set('Content-Type', 'application/json')

    expect(res.status).toBe(400)
  })

  it('404 when token not found', async () => {
    vi.mocked(validateToken).mockResolvedValue(null as any)

    const res = await request(app)
      .post('/auth/v1/validate-token')
      .send({ token_id: 'tok-does-not-exist' })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('TOKEN_NOT_FOUND')
  })

  it('503 on internal error — TCN must fail closed on this response', async () => {
    vi.mocked(validateToken).mockRejectedValue(new Error('DB timeout'))

    const res = await request(app)
      .post('/auth/v1/validate-token')
      .send({ token_id: 'tok-001' })

    expect(res.status).toBe(503)
    expect(res.body.error).toBe('TCM_UNAVAILABLE')
    // Response must instruct TCN to deny — fail-closed
    expect(res.body.message).toMatch(/deny/i)
  })

  it('400 rejects array as token_id', async () => {
    const res = await request(app)
      .post('/auth/v1/validate-token')
      .send({ token_id: ['tok-001'] })

    expect(res.status).toBe(400)
  })
})
