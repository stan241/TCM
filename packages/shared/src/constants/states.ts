/**
 * State machine constants — TCM v4
 * Source of truth: TCM-STATEMACHINE-006 v4
 */

/** RBAC roles — on-chain and off-chain */
export const ROLES = {
  ISSUER_ROLE:           'ISSUER_ROLE',
  COMPLIANCE_ROLE:       'COMPLIANCE_ROLE',
  REVOCATION_ROLE_TCM:   'REVOCATION_ROLE_TCM',
  REVOCATION_ROLE_TCN:   'REVOCATION_ROLE_TCN',
  PAUSER_ROLE:           'PAUSER_ROLE',
  SYNC_ROLE:             'SYNC_ROLE',             // TCTOutcomeRegistry only
  WORKFLOW_ADMIN_ROLE:   'WORKFLOW_ADMIN_ROLE',
} as const

/** Permission tiers with TCN access rules — Doc5 §IV */
export const PERMISSION_TIERS = {
  VIEWER:      { tcnAccess: true,  description: 'Gate 5 complete. No project_id embedded.' },
  PARTICIPANT: { tcnAccess: true,  description: 'Gate 6 complete. Project participation elected.' },
  null:        { tcnAccess: false, description: 'Deny access.' },
} as const

/** Credential class — v1 only */
export const CREDENTIAL_CLASS = {
  V1: '0x0001',
} as const

/** Network IDs */
export const NETWORKS = {
  POLYGON_MAINNET: { chainId: 137,   name: 'Polygon PoS',       env: 'production' },
  POLYGON_AMOY:    { chainId: 80002, name: 'Polygon PoS Amoy',  env: 'staging'    },
  POLYGON_MUMBAI:  { chainId: 80001, name: 'Polygon PoS Mumbai', env: 'development'},
} as const

/** Auth API error codes — Doc5 §V */
export const AUTH_ERRORS = {
  TOKEN_NOT_FOUND:           { http: 404, code: 'TOKEN_NOT_FOUND' },
  INVALID_SERVICE_CREDENTIAL:{ http: 401, code: 'INVALID_SERVICE_CREDENTIAL' },
  RATE_LIMIT_EXCEEDED:       { http: 429, code: 'RATE_LIMIT_EXCEEDED' },
  TCM_UNAVAILABLE:           { http: 503, code: 'TCM_UNAVAILABLE' },
} as const
