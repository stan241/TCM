-- Store 6: Chain Registry / Config
-- TCM-ARCH-004 v4 §IV — Low sensitivity
-- Networks, contract addresses, adapter versions, RPC endpoints,
-- finality thresholds, gas markup %, TCTOutcomeRegistry UUPS proxy timelock config.

CREATE TABLE chain_registry (
  chain_id            INTEGER     PRIMARY KEY,
  network_name        TEXT        NOT NULL,   -- 'Polygon PoS' | 'Polygon PoS Amoy' | 'Polygon PoS Mumbai'
  environment         TEXT        NOT NULL CHECK (environment IN ('production','staging','development')),
  rpc_url_primary     TEXT        NOT NULL,
  rpc_url_fallback    TEXT,
  -- Contract addresses
  tct_credential_addr TEXT,       -- TCTCredential (immutable — never changes after deploy)
  tct_outcome_addr    TEXT,       -- TCTOutcomeRegistry UUPS proxy address
  -- Finality thresholds (blocks)
  finality_soft       INTEGER     NOT NULL DEFAULT 32,
  finality_operational INTEGER    NOT NULL DEFAULT 64,
  finality_audit      INTEGER     NOT NULL DEFAULT 128,
  -- Gas config
  gas_markup_pct      NUMERIC(5,2) NOT NULL DEFAULT 30.0,  -- 30% safety margin
  -- UUPS proxy timelock (TCTOutcomeRegistry) — Stan to set before contract coding
  outcome_timelock_seconds INTEGER,
  -- Adapter version
  adapter_version     TEXT        NOT NULL DEFAULT '1.0.0',
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed data — environments
INSERT INTO chain_registry (chain_id, network_name, environment, rpc_url_primary, finality_soft, finality_operational, finality_audit)
VALUES
  (137,   'Polygon PoS',        'production',  '', 32, 64, 128),
  (80002, 'Polygon PoS Amoy',   'staging',     '', 32, 64, 128),
  (80001, 'Polygon PoS Mumbai', 'development', '', 32, 64, 128);

COMMENT ON COLUMN chain_registry.outcome_timelock_seconds IS
  'Open item: Stan to recommend timelock duration before TCTOutcomeRegistry contract coding begins.';
