#!/usr/bin/env node
/**
 * TCM Database Healthcheck
 *
 * Pings all configured database stores and reports connectivity.
 * Exits 0 if all configured stores are reachable, 1 if any fail.
 *
 * Usage: node packages/db/scripts/healthcheck.js
 */

'use strict'

const fs   = require('fs')
const path = require('path')
const { Client } = require('pg')

const envPath = path.resolve(__dirname, '../../../.env')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}

const STORES = {
  'credential-mirror': 'DATABASE_URL_CREDENTIAL_MIRROR',
  'audit-log':         'DATABASE_URL_AUDIT_LOG',
  'kyc-workflow':      'DATABASE_URL_KYC_WORKFLOW',
  'sync-pipeline':     'DATABASE_URL_SYNC_PIPELINE',
  'commercial':        'DATABASE_URL_COMMERCIAL',
  'billing':           'DATABASE_URL_BILLING',
}

async function checkStore(label, connString) {
  const client = new Client({ connectionString: connString, connectionTimeoutMillis: 3000 })
  const start  = Date.now()
  try {
    await client.connect()
    const res = await client.query('SELECT NOW() as ts, version() as ver')
    const ms  = Date.now() - start
    const pg  = res.rows[0].ver.split(' ').slice(0, 2).join(' ')
    console.log(`  ✓ ${label.padEnd(18)} ${ms}ms  ${pg}`)
    await client.end()
    return true
  } catch (err) {
    const ms = Date.now() - start
    console.error(`  ✗ ${label.padEnd(18)} ${ms}ms  ${err.message}`)
    try { await client.end() } catch {}
    return false
  }
}

async function main() {
  console.log('TCM Database Healthcheck\n')
  const results = []

  for (const [label, envVar] of Object.entries(STORES)) {
    const connString = process.env[envVar]
    if (!connString) {
      console.log(`  - ${label.padEnd(18)} SKIP (${envVar} not set)`)
      results.push(true)
      continue
    }
    results.push(await checkStore(label, connString))
  }

  const failed = results.filter(r => !r).length
  console.log(`\n${results.length - failed}/${results.length} stores healthy`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Healthcheck crashed:', err)
  process.exit(1)
})
