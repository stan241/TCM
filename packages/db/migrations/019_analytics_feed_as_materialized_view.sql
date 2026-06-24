-- Migration 019: Collapse Analytics Feed to materialized view inside Outcome Store
-- Per June 12 consolidation analysis — execution step 4
-- analytics_feed was an empty standalone store (Store 12) — feed is a projection of outcome data
-- Replaced with a MATERIALIZED VIEW over outcome_reference_store
-- DATABASE_URL_ANALYTICS_FEED retired — shares DATABASE_URL_OUTCOME_STORE
-- No separate store needed until TCA connects at v1.1

-- This runs on the Outcome Reference Store DB (DATABASE_URL_OUTCOME_STORE)

-- ── analytics.feed (materialized view) ───────────────────────────────────────
-- Pseudonymized projection — NO PII, NO wallet address, NO identity_binding
-- Doc7 §IV: cross-workflow correlation indexes that re-identify users are PROHIBITED

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE MATERIALIZED VIEW analytics.feed AS
SELECT
  gen_random_uuid()                   AS feed_id,
  -- pseudonym_id: deterministic UUID from token_id — NOT identity_binding (Doc7 §I)
  -- Uses MD5 as a non-cryptographic pseudonymizer; token_id is already non-PII
  uuid_generate_v5(
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
    token_id
  )                                   AS pseudonym_id,
  CASE
    WHEN finalized = false THEN 'credential.outcome.provisional'
    ELSE 'credential.outcome.finalized'
  END                                 AS event_type,
  result_type,
  NULL::TEXT                          AS jurisdiction_code,  -- coarse only; sourced from credential mirror join in v1.1
  chain_id::TEXT                      AS network_id,
  effective_at                        AS event_time,
  jsonb_build_object(
    'result_subtype',      result_subtype,
    'finalized',           finalized,
    'block_confirmations', block_confirmations
  )                                   AS metadata,
  now()                               AS materialized_at
FROM outcome_reference_store
-- Cross-workflow re-identification guard: no join back to credential_state_mirror here
;

-- Refresh index — used by REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_analytics_feed_token_event
  ON analytics.feed (pseudonym_id, event_time);

CREATE INDEX idx_analytics_feed_event_type ON analytics.feed (event_type);
CREATE INDEX idx_analytics_feed_time       ON analytics.feed (event_time DESC);

COMMENT ON MATERIALIZED VIEW analytics.feed IS
  'Pseudonymized downstream projection of outcome_reference_store. No PII, no wallet, no identity_binding. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.feed. Store 12 retired as standalone DB. TCA v1.1 will join jurisdiction_code from credential mirror.';

-- Convenience function to refresh the feed (called by sync pipeline after each batch)
CREATE OR REPLACE FUNCTION analytics.refresh_feed()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.feed;
END;
$$;
