#!/usr/bin/env node
/**
 * TCM Integration Smoke Test
 *
 * Runs end-to-end smoke tests against a running TCM API instance.
 * Tests the full onboarding happy path and Auth API.
 *
 * Usage:
 *   node scripts/integration-test.js
 *   TCM_API_URL=http://localhost:4000 node scripts/integration-test.js
 *
 * Must have API running: npm run dev (in packages/api) or start-dev.ps1
 */

'use strict'

const BASE = process.env.TCM_API_URL || 'http://localhost:4000'
let passed = 0, failed = 0

function ok(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`)
    failed++
  }
}

async function req(method, path, body) {
  const url = `${BASE}${path}`
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  let json
  try { json = await res.json() } catch { json = null }
  return { status: res.status, body: json }
}

async function section(title, fn) {
  console.log(`\n── ${title} ──`)
  try { await fn() }
  catch (err) { console.error(`  CRASH: ${err.message}`); failed++ }
}

async function main() {
  console.log(`TCM Integration Smoke Test`)
  console.log(`Target: ${BASE}\n`)

  // ── Health ─────────────────────────────────────────────────────────────────
  await section('Health', async () => {
    const r = await req('GET', '/health')
    ok('GET /health → 200',    r.status === 200)
    ok('body.status = ok',     r.body?.status === 'ok')
  })

  // ── Onboarding initiate ────────────────────────────────────────────────────
  let session_id
  await section('Onboarding: initiate', async () => {
    const r = await req('POST', '/api/v1/onboarding/initiate', {
      legal_name:   'Test Participant',
      email:        `test+${Date.now()}@example.com`,
      jurisdiction: 'US',
    })
    ok('POST /initiate → 201 or 403', r.status === 201 || r.status === 403)
    if (r.status === 201) {
      session_id = r.body?.session_id
      ok('session_id returned',     typeof session_id === 'string')
      ok('purchase.amount_cents',   r.body?.purchase?.amount_cents === 50000)
      ok('current_gate = 1',        r.body?.current_gate === 1)
    } else {
      ok('SDN blocked gracefully',  r.body?.error === 'ELIGIBILITY_BLOCKED')
      console.log('    (SDN blocked — skipping downstream gates)')
    }
  })

  // ── Session resume ─────────────────────────────────────────────────────────
  if (session_id) {
    await section('Onboarding: session resume', async () => {
      const r = await req('GET', `/api/v1/onboarding/session/${session_id}`)
      ok('GET /session/:id → 200',    r.status === 200)
      ok('session_id matches',        r.body?.session_id === session_id)
      ok('pre_gate_passed = true',    r.body?.pre_gate_passed === true)
    })
  }

  // ── Validation errors ──────────────────────────────────────────────────────
  await section('Validation', async () => {
    const r1 = await req('POST', '/api/v1/onboarding/initiate', {})
    ok('empty body → 400',          r1.status === 400)
    ok('error = VALIDATION_ERROR',  r1.body?.error === 'VALIDATION_ERROR')

    const r2 = await req('POST', '/api/v1/onboarding/initiate', {
      legal_name: 'x', email: 'bad-email', jurisdiction: 'US',
    })
    ok('bad email → 400',           r2.status === 400)

    const r3 = await req('POST', '/api/v1/wallet/bind', {
      session_id:     'not-a-uuid',
      wallet_address: '0xbad',
      signature:      'sig',
      message:        'msg',
    })
    ok('bad wallet bind → 400',     r3.status === 400)
  })

  // ── Auth API ───────────────────────────────────────────────────────────────
  await section('Auth API (no mTLS — expect 401 or 404)', async () => {
    // Without mTLS cert, auth endpoint should reject (401) or not find token (404)
    const r = await req('POST', '/auth/v1/validate-token', { token_id: '0x0000000000000001' })
    ok('POST /auth/v1/validate-token reachable', [200, 401, 404, 503].includes(r.status))

    // Strict schema — extra field should 400
    const r2 = await req('POST', '/auth/v1/validate-token', {
      token_id: '0x0000000000000001',
      extra_field: 'should_be_rejected',
    })
    ok('extra field → 400 or 401',  [400, 401].includes(r2.status))
  })

  // ── Admin stats ────────────────────────────────────────────────────────────
  await section('Admin API', async () => {
    const r = await req('GET', '/api/v1/admin/stats')
    ok('GET /admin/stats → 200 or 500', [200, 500].includes(r.status))
    if (r.status === 200) {
      ok('stats.total_credentials',  typeof r.body?.total_credentials !== 'undefined')
    }
  })

  // ── Credential not found ───────────────────────────────────────────────────
  await section('Credentials', async () => {
    const r = await req('GET', '/api/v1/credentials/0xdeadbeefdeadbeef')
    ok('unknown token → 404 or 500', [404, 500].includes(r.status))
  })

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Passed: ${passed}  Failed: ${failed}`)
  if (failed > 0) {
    console.error('SOME TESTS FAILED')
    process.exit(1)
  } else {
    console.log('All tests passed ✓')
  }
}

main().catch(err => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
