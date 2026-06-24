-- Migration 020: TCA Onboarding Engine — Option B shallow integration
-- Adds tca_engagement_id to onboarding_session so TCA owns the engagement record
-- while TCM owns the credential lifecycle.
--
-- Integration model (TCA-ONBENG-TRD-2026-001 §integration):
--   - Portal creates a TCA engagement (POST /api/v1/engagements) at Gate 1
--   - TCA engagement.approved event is the hard gate before TCT credential minting
--   - tca_engagement_id is the cross-system reference — no FK across DBs
--   - TCM fires engagement.approved at Gate 4 (mint + activate)
--   - TCA overlay.entity_overlay row for TCM activates at Gate 4

-- This runs on the Credential Mirror / Portal DB (DATABASE_URL_CREDENTIAL_MIRROR)

ALTER TABLE onboarding_session
  ADD COLUMN tca_engagement_id    UUID,
  ADD COLUMN tca_engagement_status TEXT
    CHECK (tca_engagement_status IN ('DRAFT','PENDING_APPROVAL','APPROVED','CLOSED'))
    DEFAULT 'DRAFT',
  ADD COLUMN tca_approved_at      TIMESTAMPTZ;

CREATE INDEX idx_onboarding_tca_engagement ON onboarding_session(tca_engagement_id)
  WHERE tca_engagement_id IS NOT NULL;

COMMENT ON COLUMN onboarding_session.tca_engagement_id IS
  'TCA Onboarding Engine engagement UUID. Set at Gate 1. No DB-level FK — validated at API layer only. NULL until TCA engagement created.';

COMMENT ON COLUMN onboarding_session.tca_engagement_status IS
  'Shadow of TCA engagement status. APPROVED required before Gate 4 mint. Updated via inbound TCA webhook.';

COMMENT ON COLUMN onboarding_session.tca_approved_at IS
  'Timestamp of TCA engagement.approved event. Must be set before mintAndActivate is called.';

-- ── TCA overlay placeholder for TCM ──────────────────────────────────────────
-- Per TCA DBSPEC overlay.entity_overlay: TCM placeholder row
-- This is a reference record only — the full overlay schema lives in TCA
CREATE TABLE IF NOT EXISTS tca_overlay_ref (
  overlay_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type         TEXT        NOT NULL DEFAULT 'TCM',
  entity_version      TEXT        NOT NULL DEFAULT '1.0',
  active              BOOLEAN     NOT NULL DEFAULT true,
  -- TCM-specific overlay config
  credential_class    TEXT        NOT NULL DEFAULT '0x0001',
  gate_count          INTEGER     NOT NULL DEFAULT 5,
  mint_at_gate        INTEGER     NOT NULL DEFAULT 4,
  engagement_required BOOLEAN     NOT NULL DEFAULT true,  -- engagement.approved required before mint
  notes               TEXT        DEFAULT 'TCM credential overlay — shallow integration Option B',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tca_overlay_ref
  (entity_type, entity_version, credential_class, gate_count, mint_at_gate, engagement_required, notes)
VALUES
  ('TCM', '1.0', '0x0001', 5, 4, true,
   'TCM credential issuance overlay. TCA engagement.approved is hard gate before Gate 4 mint. Full overlay migration to TCA engine planned for v1.1.');

COMMENT ON TABLE tca_overlay_ref IS
  'TCM-side reference for TCA overlay config. engagement_required=true means tca_engagement_status must be APPROVED before mintAndActivate. Full TCA overlay schema in TCA Onboarding Engine DB.';
