-- name: CreateConversation :one
INSERT INTO conversations (id, world_id, user_id, title)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetConversation :one
SELECT * FROM conversations WHERE id = $1;

-- name: ListConversations :many
SELECT c.*, (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
FROM conversations c
WHERE c.world_id = $1 AND c.user_id = $2
ORDER BY c.created_at DESC;

-- name: UpdateConversationEvicted :exec
UPDATE conversations SET evicted = $2 WHERE id = $1;

-- name: UpdateConversationTitle :exec
UPDATE conversations SET title = $2 WHERE id = $1 AND title = '';

-- name: CreateMessage :one
INSERT INTO messages (id, conversation_id, role, content)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListMessages :many
SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at;

-- name: CreatePin :exec
INSERT INTO context_pins (user_id, world_id, entry_id, with_neighbors)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, world_id, entry_id)
DO UPDATE SET with_neighbors = EXCLUDED.with_neighbors;

-- name: DeletePin :exec
DELETE FROM context_pins WHERE user_id = $1 AND world_id = $2 AND entry_id = $3;

-- name: ListPins :many
SELECT p.*, e.title
FROM context_pins p
JOIN entries e ON e.id = p.entry_id
WHERE p.user_id = $1 AND p.world_id = $2
ORDER BY p.created_at;
