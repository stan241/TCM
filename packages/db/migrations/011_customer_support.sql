-- Store 11: Customer Support / Case
-- TCM-ARCH-004 v4 §IV — Medium sensitivity
-- Tickets, communications, case state.
-- READS from credential_state_mirror and audit_log only — no direct writes to other stores.

CREATE TABLE support_ticket (
  ticket_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Participant reference — pseudonymous only (no PII in this store)
  token_id        TEXT,                       -- FK to credential_state_mirror (optional — pre-activation)
  participant_email_hash TEXT NOT NULL,       -- SHA-256 of email — never plaintext
  category        TEXT        NOT NULL CHECK (category IN (
    'KYC_QUERY','WALLET_ISSUE','CREDENTIAL_STATUS','COMPLIANCE','GENERAL','ESCALATION'
  )),
  status          TEXT        NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','ESCALATED','CLOSED')),
  priority        TEXT        NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  subject         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE TABLE support_case_note (
  note_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID        NOT NULL REFERENCES support_ticket(ticket_id),
  author_id       TEXT        NOT NULL,       -- staff user ID
  note_text       TEXT        NOT NULL,
  is_internal     BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_token    ON support_ticket(token_id);
CREATE INDEX idx_support_status   ON support_ticket(status);

COMMENT ON TABLE support_ticket IS
  'Reads credential_state_mirror and audit_log only. Participant email stored as hash only.';
