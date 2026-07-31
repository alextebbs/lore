-- name: CreateEntry :one
INSERT INTO entries (id, world_id, type_id, title, fields, body, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetEntry :one
SELECT * FROM entries WHERE id = $1;

-- name: ListEntries :many
SELECT e.*, t.name AS type_name
FROM entries e
JOIN entry_types t ON t.id = e.type_id
WHERE e.world_id = $1
ORDER BY t.name, e.title;

-- name: UpdateEntry :one
UPDATE entries
SET title = $2, fields = $3, body = $4, status = $5, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CreateRevision :one
INSERT INTO revisions (id, entry_id, author, title, fields, body, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListRevisions :many
SELECT id, entry_id, author, status, created_at
FROM revisions
WHERE entry_id = $1
ORDER BY created_at DESC;

-- name: GetRevision :one
SELECT * FROM revisions WHERE id = $1;
