import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ── Mocks declared before any imports that trigger module load ─────────────────
vi.mock('../db', () => ({
  db: { query: vi.fn() },
}))

vi.mock('../services/wallet/signatureVerifier', () => ({
  verifyWalletSignature: vi.fn(),
}))

vi.mock('../services/audit/auditWriter', () => ({
  createAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { walletRouter } from '../routes/wallet/index'
import { db } from '../db'
import { verifyWalletSignature } from '../services/wallet/signatureVerifier'

const app = express()
app.use(express.json())
app.use('/api/v1/wallet', walletRouter)

const SESSION_ID  = '550e8400-e29b-41d4-a716-446655440000'
const WALLET_ADDR = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const SIGNATURE   = '0x' + 'a'.repeat(130)
const VALID_MSG   = `Bind wallet to TCM session ${SESSION_ID}`

const ACTIVE_SESSION = {
  session_id:   SESSION_ID,
  gate2_passed: true,
  gate3_passed: false,
  kyc_case_id:  'kyc-case-123',
  expires_at:   new Date(Date.now() + 86400000).toISOString(),
}

// Enable dev sig bypass globally for this test file
const origNodeEnv  = process.env.NODE_ENV
const origSkipSig  = process.env.SKIP_SIG_VERIFY
beforeEach(() => {
  vi.clearAllMocks()
  process.env.NODE_ENV       = 'test'
  process.env.SKIP_SIG_VERIFY = 'true'
})
afterEach(() => {
  process.env.NODE_ENV        = origNodeEnv
  process.env.SKIP_SIG_VERIFY = origSkipSig
})

// Mock db.query to return the correct rows for the wallet bind flow.
// The route executes these queries in order:
//   1. Load session
//   2. Check existing credential (wallet already bound check)
//   3. UPDATE session (mark gate3_passed)
//   4. createAuditEvent DB write (mocked separately)
function mockSuccessfulBind() {
  vi.mocked(db.query)
    .mockResolvedValueOnce({ rows: [ACTIVE_SESSION] } as any)   // 1. session lookup
    .mockResolvedValueOnce({ rows: [] } as any)                  // 2. no existing credential
    .mockResolvedValueOnce({ rows: [] } as any)                  // 3. UPDATE session
}

describe('POST /api/v1/wallet/bind', () => {
  it('200 on valid bind — returns gate3_passed and identity_binding', async () => {
    mockSuccessfulBind()

    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.status).toBe(200)
    expect(res.body.gate3_passed).toBe(true)
    expect(typeof res.body.identity_binding).toBe('string')
    expect(res.body.identity_binding).toHaveLength(64) // SHA-256 hex
  })

  it('identity_binding == SHA-256(kyc_case_id:wallet_lower)', async () => {
    const { createHash } = await import('crypto')
    const expected = createHash('sha256')
      .update(`${ACTIVE_SESSION.kyc_case_id}:${WALLET_ADDR.toLowerCase()}`)
      .digest('hex')

    mockSuccessfulBind()

    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.body.identity_binding).toBe(expected)
  })

  it('200 idempotent — already gate3_passed returns immediately', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ ...ACTIVE_SESSION, gate3_passed: true }]
    } as any)

    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.status).toBe(200)
    expect(res.body.gate3_passed).toBe(true)
  })

  it('400 — replay protection: message must contain session_id', async () => {
    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: SIGNATURE, message: 'bind my wallet please',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('SIGNATURE_REPLAY_PROTECTION')
  })

  it('401 when signature invalid (sig verify enabled via mock)', async () => {
    // Disable the dev bypass so the route calls verifyWalletSignature
    process.env.NODE_ENV        = 'production'
    process.env.SKIP_SIG_VERIFY = 'false'

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [ACTIVE_SESSION] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)

    vi.mocked(verifyWalletSignature).mockResolvedValue({
      valid: false, method: 'eip191', reason: 'recovered address mismatch',
    })

    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('SIGNATURE_INVALID')
  })

  it('409 when wallet already has an active credential', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [ACTIVE_SESSION] } as any)
      .mockResolvedValueOnce({ rows: [{ token_id: 'tok-existing' }] } as any)

    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('WALLET_ALREADY_BOUND')
  })

  it('400 when gate2 not passed', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ ...ACTIVE_SESSION, gate2_passed: false }]
    } as any)

    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('GATE2_NOT_PASSED')
  })

  it('404 when session not found or expired', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [] } as any)

    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('SESSION_NOT_FOUND')
  })

  it('400 on invalid wallet address', async () => {
    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: 'not-a-wallet',
      signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('400 on signature too short', async () => {
    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: '0xdeadbeef', message: VALID_MSG,
    })

    expect(res.status).toBe(400)
  })

  it('400 on missing session_id', async () => {
    const res = await request(app).post('/api/v1/wallet/bind').send({
      wallet_address: WALLET_ADDR, signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.status).toBe(400)
  })

  it('500 on unexpected DB error — does not leak error details', async () => {
    vi.mocked(db.query).mockRejectedValue(new Error('connection reset'))

    const res = await request(app).post('/api/v1/wallet/bind').send({
      session_id: SESSION_ID, wallet_address: WALLET_ADDR,
      signature: SIGNATURE, message: VALID_MSG,
    })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(res.body)).not.toContain('connection reset')
  })
})
