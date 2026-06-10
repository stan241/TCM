-- Store (Portal): Onboarding Session
-- TCM-INTAKE-PORTAL-010 v4 §VI — exact schema from spec
-- Server-side session state. Client derives UI state from this.
-- NO sensitive data in localStorage or sessionStorage.
-- Session TTL: 7 days. Participant resumes via email + OTP.

CREATE TABLE onboarding_session (
  session_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_email  TEXT        NOT NULL,
  current_gate       INTEGER     NOT NULL DEFAULT 1,       -- 1-5
  -- Gate passage flags
  pre_gate_passed    BOOLEAN     NOT NULL DEFAULT false,   -- purchase confirm + SDN check
  gate1_passed       BOOLEAN     NOT NULL DEFAULT false,   -- purchase confirmed
  gate2_passed       BOOLEAN     NOT NULL DEFAULT false,   -- KYC verified
  kyc_case_id        TEXT        REFERENCES kyc_case(case_id),  -- Persona or JPM inquiry ID
  gate3_passed       BOOLEAN     NOT NULL DEFAULT false,   -- wallet bound
  wallet_address     TEXT,                                 -- confirmed wallet (after gate 3)
  gate4_passed       BOOLEAN     NOT NULL DEFAULT false,   -- minted + activated (single operation)
  token_id           TEXT,                                 -- after mint at Active state
  tx_hash            TEXT,                                 -- mint transaction hash
  gate5_passed       BOOLEAN     NOT NULL DEFAULT false,   -- confirmation shown
  activated_at       TIMESTAMPTZ,
  credential_status  TEXT CHECK (credential_status IN ('ACTIVE','PENDING','FAILED')),
  -- Session metadata
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at         TIMESTAMPTZ NOT NULL                  -- 7-day TTL from created_at
);

-- Gate progression constraint — cannot skip gates
ALTER TABLE onboarding_session ADD CONSTRAINT gate_progression CHECK (
  -- Each gate can only pass if the prior gate passed
  (gate2_passed = false OR gate1_passed = true) AND
  (gate3_passed = false OR gate2_passed = true) AND
  (gate4_passed = false OR gate3_passed = true) AND
  (gate5_passed = false OR gate4_passed = true)
);

CREATE INDEX idx_onboarding_email   ON onboarding_session(participant_email);
CREATE INDEX idx_onboarding_token   ON onboarding_session(token_id);
CREATE INDEX idx_onboarding_expires ON onboarding_session(expires_at);

-- Auto-expire: clean up sessions past TTL (run as scheduled job)
COMMENT ON TABLE onboarding_session IS
  'Portal session state. Doc10 §VI exact schema. 7-day TTL. Resume via email+OTP. No sensitive data outside this table.';
