-- Store 9: KYC / Compliance Workflow
-- TCM-ARCH-004 v4 §IV — High sensitivity
-- Open verification cases, SDN screening state, jurisdiction determinations.
-- Linked to vault by case_id ONLY — no direct FK to identity vault.
-- 5-year minimum retention (Doc7 §VI).

CREATE TABLE kyc_case (
  case_id         TEXT        PRIMARY KEY,  -- Persona inquiry ID or JPM case ID
  session_id      UUID        NOT NULL,     -- onboarding_session_id (FK added in migration 014)
  vendor          TEXT        NOT NULL CHECK (vendor IN ('persona','jpm')),
  status          TEXT        NOT NULL CHECK (status IN ('OPEN','VERIFIED','FAILED','RESTRICTED','UNDER_REVIEW')),
  jurisdiction_code TEXT,
  failure_reason  TEXT,
  -- SDN screening
  sdn_checked     BOOLEAN     NOT NULL DEFAULT false,
  sdn_blocked     BOOLEAN     NOT NULL DEFAULT false,
  sdn_checked_at  TIMESTAMPTZ,
  -- Timestamps
  initiated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Re-vetting cadence by risk tier (Doc2 §IV Rev 4)
CREATE TABLE participant_risk_tier (
  token_id        TEXT        PRIMARY KEY,  -- FK to credential_state_mirror added in migration 002
  risk_tier       TEXT        NOT NULL CHECK (risk_tier IN ('HIGH','MEDIUM','LOW')),
  -- HIGH: annual (12mo), MEDIUM: biennial (24mo), LOW: triennial (36mo)
  next_revetting  TIMESTAMPTZ NOT NULL,
  assigned_by     TEXT        NOT NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed   TIMESTAMPTZ
);

CREATE TABLE sdn_screening_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         TEXT        NOT NULL REFERENCES kyc_case(case_id),
  screen_type     TEXT        NOT NULL CHECK (screen_type IN ('PRE_PURCHASE','PERIODIC','TRIGGERED')),
  result          TEXT        NOT NULL CHECK (result IN ('CLEAR','BLOCKED','REVIEW')),
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  vendor_ref      TEXT
);

COMMENT ON TABLE kyc_case IS
  'Linked to identity_vault by case_id only — no FK. High sensitivity. 5-year minimum retention.';
COMMENT ON TABLE sdn_screening_log IS
  'SDN kill switch: if blocked at any time post-activation, trigger immediate REVOCATION_ROLE_TCM revocation.';
