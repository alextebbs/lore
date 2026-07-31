-- +goose Up
CREATE TABLE conversations (
    id         uuid PRIMARY KEY,
    world_id   uuid NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users (id),
    title      text NOT NULL DEFAULT '',
    -- auto-retrieved entries the user evicted for this conversation
    evicted    jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id              uuid PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    role            text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    -- content blocks: text, tool_use, tool_result (agent-loop transcript)
    content         jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_by_conversation ON messages (conversation_id, created_at);

-- The context tray: pinned entries follow the user per world (SPEC).
CREATE TABLE context_pins (
    user_id        uuid NOT NULL REFERENCES users (id),
    world_id       uuid NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
    entry_id       uuid NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
    with_neighbors boolean NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, world_id, entry_id)
);

-- +goose Down
DROP TABLE context_pins;
DROP TABLE messages;
DROP TABLE conversations;
