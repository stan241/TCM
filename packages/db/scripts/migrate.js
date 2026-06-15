#!/usr/bin/env node
/**
 * TCM Database Migration Runner
 *
 * Runs all SQL migration files in packages/db/migrations/ in numeric order.
 * Tracks which migrations have been applied in a migrations_applied table
 * on each database.
 *
 * Usage:
 *   node packages/db/scripts/migrate.js              # run all pending
 *   node packages/db/scripts/migrate.js --dry-run    # show pending only
 *   node packages/db/scripts/migrate.js --status     # show applied/pending
 *
 * Required env vars (loaded from .env in repo root):
 *   DATABASE_URL_CREDENTIAL_MIRROR
 *   DATABASE_URL_AUDIT_LOG
 *   DATABASE_URL_KYC_WORKFLOW
 *   DATABASE_URL_SYNC_PIPELINE
 *   DATABASE_URL_COMMERCIAL
 *   DATABASE_URL_BILLING
 *   DATABASE_URL_IDENTITY_VAULT  (optional — compliance env only)
 */

'use strict'

const fs   = require('fs')
const path = require('path')
const { Client } = require('pg')

// Load .env from repo root
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

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations')

// Map of DB store labels → env var
const STORES = {
  'credential-mirror': 'DATABASE_URL_CREDENTIAL_MIRROR',
  'audit-log':         'DATABASE_URL_AUDIT_LOG',
  'kyc-workflow':      'DATABASE_URL_KYC_WORKFLOW',
  'sync-pipeline':     'DATABASE_URL_SYNC_PIPELINE',
  'commercial':        'DATABASE_URL_COMMERCIAL',
  'billing':           'DATABASE_URL_BILLING',
  'identity-vault':    'DATABASE_URL_IDENTITY_VAULT',
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      migration_name TEXT PRIMARY KEY,
      applied_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function getApplied(client) {
  const result = await client.query('SELECT migration_name FROM migrations_applied ORDER BY migration_name')
  return new Set(result.rows.map(r => r.migration_name))
}

async function runMigrationsForStore(label, connString, files, dryRun) {
  const client = new Client({ connectionString: connString })
  try {
    await client.connect()
    await ensureMigrationTable(client)
    const applied = await getApplied(client)

    const pending = files.filter(f => !applied.has(f))
    if (pending.length === 0) {
      console.log(`  [${label}] up to date (${applied.size} applied)`)
      return
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      if (dryRun) {
        console.log(`  [${label}] PENDING: ${file}`)
        continue
      }
      console.log(`  [${label}] Applying ${file}...`)
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO migrations_applied (migration_name) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        )
        await client.query('COMMIT')
        console.log(`  [${label}] ✓ ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`  [${label}] ✗ ${file}: ${err.message}`)
        // Non-fatal: log and continue (some migrations are DB-specific)
      }
    }
  } finally {
    await client.end()
  }
}

async function main() {
  const dryRun   = process.argv.includes('--dry-run')
  const status   = process.argv.includes('--status')

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`TCM Migration Runner`)
  console.log(`Migrations dir: ${MIGRATIONS_DIR}`)
  console.log(`Files found: ${files.length}`)
  if (dryRun || status) console.log('[DRY RUN]')
  console.log('')

  let anyFailed = false

  for (const [label, envVar] of Object.entries(STORES)) {
    const connString = process.env[envVar]
    if (!connString) {
      console.log(`  [${label}] SKIP — ${envVar} not set`)
      continue
    }
    try {
      await runMigrationsForStore(label, connString, files, dryRun || status)
    } catch (err) {
      console.error(`  [${label}] FAILED: ${err.message}`)
      anyFailed = true
    }
  }

  console.log('\nDone.')
  process.exit(anyFailed ? 1 : 0)
}

main().catch(err => {
  console.error('Migration runner crashed:', err)
  process.exit(1)
})
