-- Migration 016: Consolidate Billing & Reconciliation into Commercial (schema partition)
-- Per June 12 consolidation analysis — execution step 1 (lowest risk)
-- billing_unit, chain_cost_ledger, reconciliation_run move to billing schema
-- DATABASE_URL_BILLING is retired — both stores now share DATABASE_URL_COMMERCIAL

-- Create billing schema within the Commercial DB
CREATE SCHEMA IF NOT EXISTS billing;

-- ── billing.billing_unit ─────────────────────────────────────────────────────
-- Moved from standalone Store 13. Revenue recognition rule preserved.
CREATE TABLE billing.billing_unit (
  unit_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id            TEXT        NOT NULL,
  order_id            UUID        NOT NULL REFERENCES public.orders(order_id),
  event_type          TEXT        NOT NULL,   -- 'mint', 'kyc_verification', etc.
  -- REVENUE RECOGNITION: no revenue until Audit Final (128 blocks). Non-waivable.
  audit_final         BOOLEAN     NOT NULL DEFAULT false,
  block_number        BIGINT,
  block_confirmations INTEGER     NOT NULL DEFAULT 0,
  recognized_at       TIMESTAMPTZ,            -- NULL until audit_final = true
  amount_cents        INTEGER     NOT NULL,
  currency            TEXT        NOT NULL DEFAULT 'USD',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_unit_token      ON billing.billing_unit(token_id);
CREATE INDEX idx_billing_unit_recognized ON billing.billing_unit(recognized_at) WHERE recognized_at IS NOT NULL;
CREATE INDEX idx_billing_unit_unrecog    ON billing.billing_unit(audit_final) WHERE audit_final = false;

COMMENT ON TABLE billing.billing_unit IS
  'REVENUE RECOGNITION: recognized_at is NULL until audit_final=true (128 blocks). Provisional = no billable units. Store 13 consolidated into commercial DB billing schema.';

-- ── billing.chain_cost_ledger ─────────────────────────────────────────────────
CREATE TABLE billing.chain_cost_ledger (
  ledger_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id            INTEGER     NOT NULL,
  tx_hash             TEXT        NOT NULL UNIQUE,
  gas_used            BIGINT      NOT NULL,
  gas_price_gwei      NUMERIC(20,9) NOT NULL,
  gas_cost_matic      NUMERIC(30,18) NOT NULL,
  gas_markup_pct      NUMERIC(5,2) NOT NULL,
  billed_amount_cents INTEGER,
  token_id            TEXT,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ccl_chain   ON billing.chain_cost_ledger(chain_id);
CREATE INDEX idx_ccl_token   ON billing.chain_cost_ledger(token_id) WHERE token_id IS NOT NULL;

-- ── billing.reconciliation_run ────────────────────────────────────────────────
-- Three reconciliation jobs (Doc8 §II) — MIRROR_VS_CHAIN, AUDIT_VS_MIRROR, BILLING_VS_EVENTS
CREATE TABLE billing.reconciliation_run (
  run_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        TEXT        NOT NULL CHECK (job_type IN ('MIRROR_VS_CHAIN','AUDIT_VS_MIRROR','BILLING_VS_EVENTS')),
  status          TEXT        NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED','DIVERGED')),
  divergences     INTEGER     NOT NULL DEFAULT 0,
  alert_fired     BOOLEAN     NOT NULL DEFAULT false,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_recon_job_type ON billing.reconciliation_run(job_type);
CREATE INDEX idx_recon_status   ON billing.reconciliation_run(status);

COMMENT ON SCHEMA billing IS
  'Billing & reconciliation consolidated from standalone Store 13 into Commercial DB. DATABASE_URL_BILLING retired. All access via DATABASE_URL_COMMERCIAL.';
