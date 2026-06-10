-- Store 8: Commercial / Merchandising
-- TCM-ARCH-004 v4 §IV — Medium sensitivity
-- Lister accounts, catalog, pricing, orders, invoices, payment references.
-- Order types: LISTER_COHORT | INDIVIDUAL_PURCHASE
-- 7-year retention (Doc7 §VI)

CREATE TABLE lister_account (
  lister_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name      TEXT        NOT NULL,
  status          TEXT        NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE credential_catalog (
  sku             TEXT        PRIMARY KEY,  -- e.g. 'TCT-0x0001-v1'
  credential_class TEXT       NOT NULL DEFAULT '0x0001',
  description     TEXT        NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true
);

CREATE TABLE pricing (
  price_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT        NOT NULL REFERENCES credential_catalog(sku),
  order_type      TEXT        NOT NULL CHECK (order_type IN ('LISTER_COHORT','INDIVIDUAL_PURCHASE')),
  amount_cents    INTEGER     NOT NULL,   -- e.g. 50000 = $500.00
  currency        TEXT        NOT NULL DEFAULT 'USD',
  effective_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to    TIMESTAMPTZ
);

CREATE TABLE orders (
  order_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_type      TEXT        NOT NULL CHECK (order_type IN ('LISTER_COHORT','INDIVIDUAL_PURCHASE')),
  lister_id       UUID        REFERENCES lister_account(lister_id),
  participant_email TEXT,
  sku             TEXT        NOT NULL REFERENCES credential_catalog(sku),
  quantity        INTEGER     NOT NULL DEFAULT 1,
  unit_price_cents INTEGER    NOT NULL,
  total_cents     INTEGER     NOT NULL,
  status          TEXT        NOT NULL CHECK (status IN ('PENDING','PAID','CANCELLED','REFUNDED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  invoice_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL REFERENCES orders(order_id),
  invoice_number  TEXT        NOT NULL UNIQUE,
  amount_cents    INTEGER     NOT NULL,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at         TIMESTAMPTZ,
  payment_ref     TEXT
);

-- Seed: default catalog entry for v1 pilot
INSERT INTO credential_catalog (sku, credential_class, description) VALUES
  ('TCT-0x0001-v1', '0x0001', 'TokenCap Token Credential — Credential Class 0x0001, v1');

INSERT INTO pricing (sku, order_type, amount_cents) VALUES
  ('TCT-0x0001-v1', 'INDIVIDUAL_PURCHASE', 50000);  -- $500.00
