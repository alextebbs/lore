-- +goose Up
-- Derived serializations (ADR 0010): card/digest are cached render
-- forms outside draft/canon; search_text feeds lexical retrieval.
-- Embeddings live in a separate runtime-created table (pgvector is not
-- guaranteed in every environment — see bead lore-8q6), keeping this
-- schema portable and sqlc static.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE entry_derived (
    entry_id    uuid PRIMARY KEY REFERENCES entries (id) ON DELETE CASCADE,
    card        text NOT NULL DEFAULT '',
    digest      text NOT NULL DEFAULT '',
    search_text text NOT NULL DEFAULT '',
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entry_derived_fts
    ON entry_derived USING gin (to_tsvector('english', search_text));
CREATE INDEX entry_derived_trgm
    ON entry_derived USING gin (search_text gin_trgm_ops);

-- +goose Down
DROP TABLE entry_derived;
