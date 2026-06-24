-- Migration 017: Consolidate Controlled-Vocab Registry into Chain Registry (schema partition)
-- Per June 12 consolidation analysis — execution step 2
-- vocab_version, vocab_result_type, vocab_result_subtype move to vocab schema
-- DATABASE_URL_VOCAB_REGISTRY is retired — shares DATABASE_URL_CHAIN_REGISTRY
-- Rationale: both are versioned config with same change-control discipline

CREATE SCHEMA IF NOT EXISTS vocab;

-- ── vocab.vocab_version ───────────────────────────────────────────────────────
CREATE TABLE vocab.vocab_version (
  id          SERIAL      PRIMARY KEY,
  version     TEXT        NOT NULL UNIQUE,  -- semver e.g. '1.0.0'
  released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_by TEXT        NOT NULL,
  notes       TEXT
);

-- ── vocab.vocab_result_type ───────────────────────────────────────────────────
CREATE TABLE vocab.vocab_result_type (
  id            SERIAL      PRIMARY KEY,
  vocab_version TEXT        NOT NULL REFERENCES vocab.vocab_version(version),
  result_type   TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  deprecated    BOOLEAN     NOT NULL DEFAULT false,
  deprecated_at TIMESTAMPTZ,
  rejection_at  TIMESTAMPTZ GENERATED ALWAYS AS (deprecated_at + INTERVAL '90 days') STORED,
  UNIQUE(vocab_version, result_type)
);

-- ── vocab.vocab_result_subtype ────────────────────────────────────────────────
CREATE TABLE vocab.vocab_result_subtype (
  id             SERIAL      PRIMARY KEY,
  vocab_version  TEXT        NOT NULL REFERENCES vocab.vocab_version(version),
  result_type    TEXT        NOT NULL,
  result_subtype TEXT        NOT NULL,
  description    TEXT        NOT NULL,
  deprecated     BOOLEAN     NOT NULL DEFAULT false,
  deprecated_at  TIMESTAMPTZ,
  rejection_at   TIMESTAMPTZ GENERATED ALWAYS AS (deprecated_at + INTERVAL '90 days') STORED,
  UNIQUE(vocab_version, result_type, result_subtype)
);

-- v1.0.0 bootstrap seed (mirrors 007_controlled_vocab_registry.sql)
INSERT INTO vocab.vocab_version (version, released_by, notes)
  VALUES ('1.0.0', 'system', 'Initial controlled vocabulary — consolidated into chain registry DB');

INSERT INTO vocab.vocab_result_type (vocab_version, result_type, description) VALUES
  ('1.0.0', 'allocation',  'Distribution or allocation determined by external authority'),
  ('1.0.0', 'vote',        'Voting outcome recorded by reference'),
  ('1.0.0', 'milestone',   'Project milestone determination notice'),
  ('1.0.0', 'notice',      'Informational notice from authoritative source'),
  ('1.0.0', 'exception',   'Compliance or contract exception event'),
  ('1.0.0', 'formation',   'Legal entity formation confirmation'),
  ('1.0.0', 'transfer',    'Fund movement acknowledgment — NOT the transfer itself'),
  ('1.0.0', 'compliance',  'Compliance state change');

INSERT INTO vocab.vocab_result_subtype (vocab_version, result_type, result_subtype, description) VALUES
  ('1.0.0','allocation','final_settlement','Final settlement allocation'),
  ('1.0.0','allocation','correction','Correction to prior allocation record'),
  ('1.0.0','allocation','lister_action','Lister-initiated allocation action'),
  ('1.0.0','vote','participant_action','Participant voting action'),
  ('1.0.0','vote','lister_action','Lister voting action'),
  ('1.0.0','vote','final_settlement','Final settlement vote'),
  ('1.0.0','milestone','final_settlement','Milestone final settlement'),
  ('1.0.0','milestone','correction','Correction to milestone record'),
  ('1.0.0','milestone','lister_action','Lister milestone action'),
  ('1.0.0','notice','participant_action','Participant notice'),
  ('1.0.0','notice','lister_action','Lister notice'),
  ('1.0.0','notice','compliance_downgrade','Compliance downgrade notice'),
  ('1.0.0','exception','sanctions_flag','Sanctions flag exception'),
  ('1.0.0','exception','compliance_downgrade','Compliance downgrade exception'),
  ('1.0.0','exception','contract_breach','Contract breach exception'),
  ('1.0.0','exception','correction','Correction to exception record'),
  ('1.0.0','formation','entity_formed','Legal entity formed'),
  ('1.0.0','formation','correction','Correction to formation record'),
  ('1.0.0','transfer','funds_escrowed','Funds escrowed acknowledgment'),
  ('1.0.0','transfer','funds_released','Funds released acknowledgment'),
  ('1.0.0','transfer','correction','Correction to transfer record'),
  ('1.0.0','compliance','sanctions_flag','Sanctions flag compliance event'),
  ('1.0.0','compliance','compliance_downgrade','Compliance downgrade event'),
  ('1.0.0','compliance','contract_breach','Contract breach compliance event');

COMMENT ON SCHEMA vocab IS
  'Controlled vocabulary consolidated from standalone Store 7 into Chain Registry DB. DATABASE_URL_VOCAB_REGISTRY retired.';
