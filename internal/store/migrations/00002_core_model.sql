-- +goose Up
CREATE TABLE users (
    id         uuid PRIMARY KEY,
    email      text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Dev user owns everything until magic-link auth lands (M1, ADR 0008).
INSERT INTO users (id, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'dev@localhost');

CREATE TABLE worlds (
    id         uuid PRIMARY KEY,
    owner_id   uuid NOT NULL REFERENCES users (id),
    name       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entry_types (
    id         uuid PRIMARY KEY,
    world_id   uuid NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
    name       text NOT NULL,
    parent_id  uuid REFERENCES entry_types (id),
    -- [{name, kind, label?, config?}] — soft schema (ADR 0004)
    fields     jsonb NOT NULL DEFAULT '[]',
    builtin    boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (world_id, name)
);

CREATE TABLE entries (
    id         uuid PRIMARY KEY,
    world_id   uuid NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
    type_id    uuid NOT NULL REFERENCES entry_types (id),
    title      text NOT NULL,
    -- {name: {value, status}} — field-level draft/canon (ADR 0002)
    fields     jsonb NOT NULL DEFAULT '{}',
    -- rich-text doc; draft/canon is a span mark (ADR 0001)
    body       jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}',
    -- derived from parts; cached here for listing/filtering
    status     text NOT NULL DEFAULT 'canon'
               CHECK (status IN ('draft', 'canon', 'mixed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entries_by_world_type ON entries (world_id, type_id);

CREATE TABLE revisions (
    id         uuid PRIMARY KEY,
    entry_id   uuid NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
    author     text NOT NULL CHECK (author IN ('human', 'ai')),
    title      text NOT NULL,
    fields     jsonb NOT NULL,
    body       jsonb NOT NULL,
    status     text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX revisions_by_entry ON revisions (entry_id, created_at DESC);

-- +goose Down
DROP TABLE revisions;
DROP TABLE entries;
DROP TABLE entry_types;
DROP TABLE worlds;
DROP TABLE users;
