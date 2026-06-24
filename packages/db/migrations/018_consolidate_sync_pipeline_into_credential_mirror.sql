-- Migration 018: Consolidate Sync Pipeline State into Credential Mirror (schema partition)
-- Per June 12 consolidation analysis — execution step 3
-- Engineering-internal only — same access pattern, no sensitivity conflict
-- sync_adapter_cursor, sync_finality_snapshot, sync_idempotency, sync_replay_checkpoint
-- move to sync schema within Credential Mirror DB
-- DATABASE_URL_SYNC_PIPELINE retired — shares DATABASE_URL_CREDENTIAL_MIRROR

CREATE SCHEMA IF NOT EXISTS sync;

-- ── sync.sync_adapter_cursor ─────────────────────────────────────────────────
-- Crash-safe resumption — never lose a sync position
CREATE TABLE sync.adapter_cursor (
  adapter_id    TEXT        PRIMARY KEY,  -- e.g. 'polygon-mainnet', 'polygon-amoy'
  chain_id      INTEGER     NOT NULL,
  last_block    BIGINT      NOT NULL DEFAULT 0,
  last_event_id TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── sync.finality_snapshot ────────────────────────────────────────────────────
CREATE TABLE sync.finality_snapshot (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id       INTEGER     NOT NULL,
  block_number   BIGINT      NOT NULL,
  finality_state TEXT        NOT NULL CHECK (finality_state IN ('OBSERVED','SOFT_FINAL','OPERATIONAL_FINAL','AUDIT_FINAL')),
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fs_chain_block ON sync.finality_snapshot(chain_id, block_number DESC);

-- ── sync.idempotency ──────────────────────────────────────────────────────────
-- Permanent — never deleted (Doc7 §VI: rolling 90-day cursor history + permanent idempotency index)
CREATE TABLE sync.idempotency (
  idempotency_key TEXT        PRIMARY KEY,  -- token_id + tx_hash + log_index
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  result          TEXT        NOT NULL CHECK (result IN ('SUCCESS','SKIPPED','FAILED'))
);

COMMENT ON TABLE sync.idempotency IS
  'Permanent — never deleted. Prevents duplicate event processing on replay or crash recovery.';

-- ── sync.replay_checkpoint ────────────────────────────────────────────────────
CREATE TABLE sync.replay_checkpoint (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id  TEXT        NOT NULL REFERENCES sync.adapter_cursor(adapter_id),
  from_block  BIGINT      NOT NULL,
  to_block    BIGINT      NOT NULL,
  reason      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rc_adapter ON sync.replay_checkpoint(adapter_id, created_at DESC);

COMMENT ON SCHEMA sync IS
  'Sync pipeline state consolidated from standalone Store 5 into Credential Mirror DB. DATABASE_URL_SYNC_PIPELINE retired.';
