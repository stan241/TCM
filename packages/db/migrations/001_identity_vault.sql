-- Store 1: Identity Vault
-- TCM-DATAGOV-007 v4 §I — CRITICAL sensitivity
-- AES-256 at rest. Access: compliance function + legally required disclosures ONLY.
-- NEVER on Engine hot path. RTBF via salt destruction.
-- Open item: confirm with JPM whether they retain docs or TCM receives/holds them.

CREATE TABLE identity_vault (
  vault_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Linkage: case_id only — no direct FK to operational stores
  kyc_case_id       TEXT        NOT NULL UNIQUE,  -- Persona inquiry ID or JPM case ID
  -- Encrypted fields (AES-256 — encryption at application layer before insert)
  legal_name_enc    BYTEA       NOT NULL,          -- Encrypted legal name
  dob_enc           BYTEA       NOT NULL,          -- Encrypted date of birth
  gov_id_hash       TEXT        NOT NULL,          -- SHA-256 of government ID number — never plaintext
  gov_id_type       TEXT        NOT NULL,          -- PASSPORT | DRIVERS_LICENSE | NATIONAL_ID
  -- Salt material — RTBF mechanism (Doc7 §II): destroy salt → identity_binding uninvertible
  salt              BYTEA       NOT NULL,          -- NEVER leave this store. Salt destruction = RTBF.
  -- KYC result
  kyc_result        TEXT        NOT NULL CHECK (kyc_result IN ('VERIFIED','FAILED','RESTRICTED','PENDING')),
  jurisdiction_code TEXT        NOT NULL,
  vendor            TEXT        NOT NULL CHECK (vendor IN ('persona','jpm')),
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at       TIMESTAMPTZ,
  -- Retention: per KYC/AML regulatory minimum. Deletion = RTBF via salt destruction.
  CONSTRAINT valid_result CHECK (
    (kyc_result = 'VERIFIED' AND verified_at IS NOT NULL) OR
    (kyc_result != 'VERIFIED')
  )
);

-- Access policy note: only compliance_role service account may SELECT/INSERT/UPDATE this table.
-- No application service account has access. Enforce at PostgreSQL role level.
COMMENT ON TABLE identity_vault IS
  'CRITICAL: AES-256 at rest. Compliance access only. RTBF via salt column destruction. Never on hot path.';
