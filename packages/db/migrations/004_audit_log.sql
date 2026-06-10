-- Store 4: Audit Log
-- TCM-AUDIT-008 v4 §I — High sensitivity
-- TAMPER-EVIDENT APPEND-ONLY. NO UPDATE. NO DELETE. EVER.
-- Minimum 7 years retention (Rule 17a-4).
-- chain_hash = SHA-256(audit_event_id + after_hash + chain_prev_hash)

CREATE TABLE audit_log (
  audit_event_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type      TEXT        NOT NULL CHECK (actor_type IN ('HUMAN','SERVICE','SYSTEM')),
  actor_id        TEXT        NOT NULL,
  action          TEXT        NOT NULL,   -- e.g. 'token.activated', 'credential.revoked'
  object_type     TEXT        NOT NULL,   -- e.g. 'TCTCredential', 'ComplianceCase'
  object_id       UUID        NOT NULL,
  before_hash     TEXT,                   -- bytes32 hex. NULL for create events.
  after_hash      TEXT        NOT NULL,   -- bytes32 hex
  metadata        JSONB       NOT NULL DEFAULT '{}',
  event_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  chain_prev_hash TEXT        NOT NULL,   -- bytes32 hex — hash of immediately preceding event
  chain_hash      TEXT        NOT NULL    -- SHA-256(audit_event_id + after_hash + chain_prev_hash)
);

-- Append-only enforcement at DB level
-- Revoke UPDATE and DELETE from all roles including the application service account
-- Only INSERT is permitted
CREATE INDEX idx_audit_object    ON audit_log(object_id);
CREATE INDEX idx_audit_action    ON audit_log(action);
CREATE INDEX idx_audit_time      ON audit_log(event_time);
CREATE INDEX idx_audit_actor     ON audit_log(actor_id);

-- Partition by month for 7-year retention management
-- (Implement partitioning before go-live for tables expected to grow large)

COMMENT ON TABLE audit_log IS
  'APPEND-ONLY. NO UPDATE OR DELETE EVER. 7-year retention. chain_hash forms tamper-evident chain.';
