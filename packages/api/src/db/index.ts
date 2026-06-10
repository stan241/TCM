/**
 * Database connection pool factory — TCM v4
 *
 * Each of the 13 stores has its own connection string and pool.
 * Stores are isolated by design (Doc7 §I — PII isolation is structural).
 *
 * Identity Vault (Store 1) uses a separate, restricted pool:
 * - Only compliance_role service account may connect
 * - Never on the Engine hot path
 */

import { Pool } from 'pg'

function makePool(envVar: string, label: string): Pool {
  const connectionString = process.env[envVar]
  if (!connectionString) {
    throw new Error(`Missing env var ${envVar} for ${label} database pool`)
  }
  return new Pool({
    connectionString,
    max:              10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: `tcm-api-${label}`,
  })
}

// Store 2 — Credential-State Mirror (Auth API hot path)
export const db = makePool('DATABASE_URL_CREDENTIAL_MIRROR', 'credential-mirror')

// Store 4 — Audit Log (separate pool — append-only, high write volume)
export const auditDb = makePool('DATABASE_URL_AUDIT_LOG', 'audit-log')

// Store 9 — KYC / Compliance Workflow
export const kycDb = makePool('DATABASE_URL_KYC_WORKFLOW', 'kyc-workflow')

// Store 5 — Sync Pipeline State
export const syncDb = makePool('DATABASE_URL_SYNC_PIPELINE', 'sync-pipeline')

// Store 8 — Commercial / Merchandising
export const commercialDb = makePool('DATABASE_URL_COMMERCIAL', 'commercial')

// Store 13 — Billing & Reconciliation
export const billingDb = makePool('DATABASE_URL_BILLING', 'billing')

// Store 1 — Identity Vault (CRITICAL — compliance access only, never hot path)
// NOTE: This pool should only be instantiated in the compliance service, not in the main API.
export function makeIdentityVaultPool(): Pool {
  return makePool('DATABASE_URL_IDENTITY_VAULT', 'identity-vault')
}
