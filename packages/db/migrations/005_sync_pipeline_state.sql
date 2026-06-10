-- Store 5: Sync Pipeline State
-- TCM-ARCH-004 v4 §IV — Low sensitivity
-- Adapter cursors, finality snapshots, idempotency-key index, replay checkpoints.
-- Crash-safe resumption — never lose a sync position.

CREATE TABLE sync_adapter_cursor (
  adapter_id      TEXT        PRIMARY KEY,  -- e.g. 'polygon-mainnet', 'base-sepolia'
  chain_id        INTEGER     NOT NULL,
  last_block      BIGINT      NOT NULL DEFAULT 0,
  last_event_id   TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_finality_snapshot (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id        INTEGER     NOT NULL,
  block_number    BIGINT      NOT NULL,
  finality_state  TEXT        NOT NULL CHECK (finality_state IN ('OBSERVED','SOFT_FINAL','OPERATIONAL_FINAL','AUDIT_FINAL')),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency key index — ensures no event processed twice
CREATE TABLE sync_idempotency (
  idempotency_key TEXT        PRIMARY KEY,  -- token_id + tx_hash + log_index
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  result          TEXT        NOT NULL      -- SUCCESS | SKIPPED | FAILED
);
-- Permanent — never deleted (Doc7 §VI: rolling 90-day cursor history + permanent idempotency index)

CREATE TABLE sync_replay_checkpoint (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id      TEXT        NOT NULL REFERENCES sync_adapter_cursor(adapter_id),
  from_block      BIGINT      NOT NULL,
  to_block        BIGINT      NOT NULL,
  reason          TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sync_idempotency IS
  'Permanent index — never deleted. Prevents duplicate event processing on replay.';
