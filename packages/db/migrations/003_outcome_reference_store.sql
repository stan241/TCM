-- Store 3: Outcome Reference Store
-- TCM-ARCH-004 v4 §IV — Low-Medium sensitivity
-- Mirror of TCTOutcomeRegistry on-chain. result_type from controlled vocab v1.0.0.
-- finalized=true ONLY after Audit Final (128 blocks on Polygon PoS).
-- REPORTER NOT DETERMINER: stores references to outcomes, never the determined value.

CREATE TABLE outcome_reference_store (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- On-chain fields (from TCTOutcomeRegistry)
  event_id            TEXT        NOT NULL UNIQUE,  -- on-chain event ID
  event_hash          TEXT        NOT NULL,          -- bytes32 integrity anchor
  contract_id         TEXT        NOT NULL,          -- which TCN contract produced this
  -- Controlled vocabulary v1.0.0 (TCM-COMPLIANCE-002 v4 §VI)
  result_type         TEXT        NOT NULL,          -- allocation|vote|milestone|notice|exception|formation|transfer|compliance
  result_subtype      TEXT        NOT NULL,
  -- Opaque pointer to authoritative record — TCM does NOT store the determined value
  offchain_authority_ref TEXT     NOT NULL,          -- opaque pointer. Never the value itself.
  -- Finality (Doc8 §III — PROVISIONAL badge until finalized=true)
  finalized           BOOLEAN     NOT NULL DEFAULT false,  -- true ONLY after Audit Final (128 blocks)
  block_number        BIGINT      NOT NULL,
  block_confirmations INTEGER     NOT NULL DEFAULT 0,
  -- Timestamps
  effective_at        TIMESTAMPTZ NOT NULL,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Linkage
  token_id            TEXT        NOT NULL REFERENCES credential_state_mirror(token_id),
  chain_id            INTEGER     NOT NULL,
  -- Controlled vocab validation (enforced at application layer too)
  CONSTRAINT valid_result_type CHECK (
    result_type IN ('allocation','vote','milestone','notice','exception','formation','transfer','compliance')
  )
);

CREATE INDEX idx_ors_token_id   ON outcome_reference_store(token_id);
CREATE INDEX idx_ors_finalized  ON outcome_reference_store(finalized);
CREATE INDEX idx_ors_result_type ON outcome_reference_store(result_type);

COMMENT ON TABLE outcome_reference_store IS
  'Reporter not determiner. Stores references only — never determined values. finalized=true after 128 blocks.';
