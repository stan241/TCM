-- Store 13: Billing & Reconciliation
-- TCM-ARCH-004 v4 §IV — Medium sensitivity
-- Metered units, chain-cost ledger with gas markup, invoice lineage.
-- REVENUE RECOGNITION RULE: no revenue recognized until Audit Final (128 blocks).
-- Provisional events do NOT produce billable units.
-- 7-year retention (Doc7 §VI).

CREATE TABLE billing_unit (
  unit_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id          TEXT        NOT NULL,
  order_id          UUID        NOT NULL REFERENCES orders(order_id),
  event_type        TEXT        NOT NULL,   -- 'mint', 'kyc_verification', etc.
  -- Revenue recognition: must be Audit Final
  audit_final       BOOLEAN     NOT NULL DEFAULT false,
  block_number      BIGINT,
  block_confirmations INTEGER   NOT NULL DEFAULT 0,
  -- Provisional events: no billable unit created until audit_final = true
  recognized_at     TIMESTAMPTZ,            -- NULL until audit_final = true
  amount_cents      INTEGER     NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'USD',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chain_cost_ledger (
  ledger_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id          INTEGER     NOT NULL,
  tx_hash           TEXT        NOT NULL UNIQUE,
  gas_used          BIGINT      NOT NULL,
  gas_price_gwei    NUMERIC(20,9) NOT NULL,
  gas_cost_matic    NUMERIC(30,18) NOT NULL,
  gas_markup_pct    NUMERIC(5,2) NOT NULL,
  billed_amount_cents INTEGER,
  token_id          TEXT,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Three reconciliation jobs (Doc8 §II)
CREATE TABLE reconciliation_run (
  run_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        TEXT        NOT NULL CHECK (job_type IN ('MIRROR_VS_CHAIN','AUDIT_VS_MIRROR','BILLING_VS_EVENTS')),
  status          TEXT        NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED','DIVERGED')),
  divergences     INTEGER     NOT NULL DEFAULT 0,
  alert_fired     BOOLEAN     NOT NULL DEFAULT false,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

COMMENT ON TABLE billing_unit IS
  'REVENUE RECOGNITION: recognized_at is NULL until audit_final=true (128 blocks). Provisional events = no billable units.';
