-- Store 2: Credential-State Mirror
-- TCM-ARCH-004 v4 §IV — Medium sensitivity
-- Off-chain authoritative read model for the Auth API and portal.
-- Auth API reads from HERE — never from chain (RPC) on hot path.
-- All 7 timestamps present. Updated by sync pipeline after every on-chain state change.

CREATE TABLE credential_state_mirror (
  token_id          TEXT        PRIMARY KEY,         -- hex string, e.g. '0x0001000000000001'
  network_id        TEXT        NOT NULL,             -- bytes8 as hex
  -- identity_binding = SHA-256(canonical_identity_record + salt). Never PII. Wallet-agnostic.
  identity_binding  TEXT        NOT NULL,             -- bytes32 as hex
  status            TEXT        NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED','EXPIRED','RETIRED')),
  -- Note: Pending is off-chain only — no row in this table for Pending credentials
  compliance_status TEXT        NOT NULL CHECK (compliance_status IN ('VERIFIED','PENDING','FAILED','RESTRICTED')),
  jurisdiction_code TEXT        NOT NULL,
  permission_tier   TEXT        CHECK (permission_tier IN ('VIEWER','PARTICIPANT')),
  claims_version    INTEGER     NOT NULL DEFAULT 1,
  -- Seven timestamps (null = not yet set)
  issued_at         TIMESTAMPTZ,                      -- Set at mint (= activated_at in single-op model)
  activated_at      TIMESTAMPTZ,                      -- Set at mint (= issued_at in single-op model)
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_at      TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  expired_at        TIMESTAMPTZ,
  retired_at        TIMESTAMPTZ,
  audit_root_hash   TEXT        NOT NULL,             -- bytes32 as hex. Refreshed on every state change.
  -- Sync metadata
  last_sync_block   BIGINT      NOT NULL DEFAULT 0,
  chain_id          INTEGER     NOT NULL
);

CREATE INDEX idx_csm_status        ON credential_state_mirror(status);
CREATE INDEX idx_csm_network       ON credential_state_mirror(network_id);
CREATE INDEX idx_csm_jurisdiction  ON credential_state_mirror(jurisdiction_code);

COMMENT ON TABLE credential_state_mirror IS
  'Auth API read model. Never use RPC on hot path — read from here. Updated by sync pipeline.';
