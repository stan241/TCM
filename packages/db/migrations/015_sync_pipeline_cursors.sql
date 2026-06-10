-- Migration 015: sync_pipeline_cursors
-- Stores the last processed block for each watched contract.
-- Allows the sync pipeline to resume after a restart without reprocessing all history.
-- Database: tcm_sync_pipeline

\c tcm_sync_pipeline;

CREATE TABLE IF NOT EXISTS sync_pipeline_cursors (
  contract_address TEXT    NOT NULL PRIMARY KEY,
  last_block       BIGINT  NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  sync_pipeline_cursors IS 'Resumable block-cursor per watched contract';
COMMENT ON COLUMN sync_pipeline_cursors.last_block IS 'Last toBlock range fully processed';
