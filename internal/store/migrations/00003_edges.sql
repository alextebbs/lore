-- +goose Up
-- Edges are first-class rows so each relation carries its own
-- draft/canon status and feeds the graph (ADR 0003).
CREATE TABLE edges (
    id         uuid PRIMARY KEY,
    world_id   uuid NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
    from_entry uuid NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
    field      text NOT NULL,
    to_entry   uuid NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
    annotation text NOT NULL DEFAULT '',
    status     text NOT NULL DEFAULT 'canon'
               CHECK (status IN ('draft', 'canon')),
    position   integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX edges_by_from ON edges (from_entry, field, position);
CREATE INDEX edges_by_to ON edges (to_entry);

-- +goose Down
DROP TABLE edges;
