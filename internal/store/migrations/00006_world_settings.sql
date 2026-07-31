-- +goose Up
ALTER TABLE worlds ADD COLUMN settings jsonb NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE worlds DROP COLUMN settings;
