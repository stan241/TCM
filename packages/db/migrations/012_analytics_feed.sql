-- Store 12: Analytics Feed Store
-- TCM-ARCH-004 v4 §IV — Low sensitivity
-- Pseudonymized feed for TCA. NO PII. NO wallet address. NO identity_binding.
-- Downstream-only — NO write-back paths.
-- Cross-workflow correlation indexes that re-identify users are PROHIBITED (Doc7 §IV).

CREATE TABLE analytics_feed (
  feed_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- pseudonym_id is a UUID — NOT identity_binding (Doc7 §I)
  pseudonym_id    UUID        NOT NULL,
  event_type      TEXT        NOT NULL,   -- e.g. 'credential.activated', 'status.changed'
  result_type     TEXT,                   -- from controlled vocab — no free-form
  jurisdiction_code TEXT,                 -- coarse jurisdiction only
  network_id      TEXT,
  event_time      TIMESTAMPTZ NOT NULL,
  -- Aggregated / coarsened data only — never individual identifying attributes
  metadata        JSONB       NOT NULL DEFAULT '{}',
  materialized_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-workflow mapping only (Doc7 §IV) — cross-workflow correlation forbidden
CREATE INDEX idx_analytics_event_type  ON analytics_feed(event_type);
CREATE INDEX idx_analytics_time        ON analytics_feed(event_time);
-- NOTE: No index on pseudonym_id alone — prevents trivial cross-workflow aggregation

COMMENT ON TABLE analytics_feed IS
  'Pseudonymized downstream only. No PII, no wallet, no identity_binding. No write-back. Cross-workflow re-identification prohibited.';
