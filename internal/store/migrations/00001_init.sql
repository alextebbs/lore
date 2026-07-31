-- +goose Up
-- pgvector backs the retrieval engine's embeddings (ADR 0006, ADR 0010).
-- Created only where available: local dev and CI images ship it; Fly's
-- stock postgres-flex images do not (tracked bead: prod pgvector before
-- M7). Retrieval degrades gracefully without it (ADR 0007).
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';
  ELSE
    RAISE WARNING 'pgvector unavailable; embeddings disabled in this environment';
  END IF;
END
$$;
-- +goose StatementEnd

-- +goose Down
DROP EXTENSION IF EXISTS vector;
