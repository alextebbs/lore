-- +goose Up
-- pgvector is required by the retrieval engine (ADR 0006, ADR 0010);
-- enabling it first ensures every environment can hold embeddings.
CREATE EXTENSION IF NOT EXISTS vector;

-- +goose Down
DROP EXTENSION IF EXISTS vector;
