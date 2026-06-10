-- Store 10: Document Attestation Store
-- TCM-ARCH-004 v4 §IV — Medium sensitivity
-- TCM holds structured attestation RECORDS AND METADATA ONLY — no document binary content.
-- 2678 accesses but does not own the underlying database.
-- offchain_authority_ref = opaque pointer to document in external system.
-- Minimum 7 years retention for formation-related attestations (Doc7 §VI).

CREATE TABLE document_attestation (
  attestation_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Document metadata only — NO binary content stored here
  document_hash         TEXT        NOT NULL,       -- SHA-256 of document content
  document_type         TEXT        NOT NULL,       -- FORMATION | COMPLIANCE | CONTRACT | OTHER
  attestation_result    TEXT        NOT NULL CHECK (attestation_result IN ('ATTESTED','REJECTED','PENDING')),
  -- Opaque pointer to the external document system — TCM does not own the document DB
  offchain_authority_ref TEXT       NOT NULL,
  -- Linkage
  token_id              TEXT,                       -- FK to credential_state_mirror (nullable — pre-activation docs)
  kyc_case_id           TEXT,                       -- FK to kyc_case (nullable)
  -- SOC-controlled access (Doc7 §III)
  attested_by           TEXT        NOT NULL,
  attested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE document_attestation IS
  'Attestation records and metadata ONLY. No document binary content. offchain_authority_ref is opaque pointer.';
COMMENT ON COLUMN document_attestation.offchain_authority_ref IS
  'Opaque pointer to the external document database. TCM holds the attestation, not the document.';
