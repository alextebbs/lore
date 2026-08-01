-- +goose Up
-- Relation identity (ADR 0015): edges reference the schema field by
-- stable ID; the name column stays for display and legacy fallback.
ALTER TABLE edges ADD COLUMN field_id TEXT NOT NULL DEFAULT '';
CREATE INDEX edges_field_id_idx ON edges (from_entry, field_id);

-- +goose Down
DROP INDEX edges_field_id_idx;
ALTER TABLE edges DROP COLUMN field_id;
