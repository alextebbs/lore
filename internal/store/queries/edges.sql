-- name: CreateEdge :one
INSERT INTO edges (id, world_id, from_entry, field, to_entry, annotation, status, position)
VALUES ($1, $2, $3, $4, $5, $6, $7,
        (SELECT COALESCE(MAX(position) + 1, 0) FROM edges
         WHERE from_entry = $3 AND field = $4))
RETURNING *;

-- name: GetEdge :one
SELECT * FROM edges WHERE id = $1;

-- name: DeleteEdge :exec
DELETE FROM edges WHERE id = $1;

-- name: ListEdgesFrom :many
SELECT e.*, t.title AS to_title, t.status AS to_entry_status,
       ty.name AS to_type_name
FROM edges e
JOIN entries t ON t.id = e.to_entry
JOIN entry_types ty ON ty.id = t.type_id
WHERE e.from_entry = $1
ORDER BY e.field, e.position;

-- name: ListEdgesTo :many
SELECT e.*, f.title AS from_title, f.status AS from_entry_status,
       f.type_id AS from_type_id, ty.name AS from_type_name
FROM edges e
JOIN entries f ON f.id = e.from_entry
JOIN entry_types ty ON ty.id = f.type_id
WHERE e.to_entry = $1
ORDER BY e.field, e.position;

-- name: ListEdgesTouching :many
SELECT * FROM edges
WHERE from_entry = ANY($1::uuid[]) OR to_entry = ANY($1::uuid[]);

-- name: PromoteEdgesFrom :exec
UPDATE edges SET status = 'canon' WHERE from_entry = $1;

-- name: GetEntriesByIDs :many
SELECT e.id, e.title, e.status, ty.name AS type_name
FROM entries e
JOIN entry_types ty ON ty.id = e.type_id
WHERE e.id = ANY($1::uuid[]);

-- name: ListEdgeRows :many
SELECT * FROM edges WHERE world_id = $1 ORDER BY from_entry, field, position;

-- name: DeleteEdgesByField :exec
DELETE FROM edges WHERE from_entry = $1 AND field = $2;

-- name: ListMentionEdgesTo :many
SELECT * FROM edges WHERE to_entry = $1 AND field = 'mentions';

-- name: RenameEdgeField :exec
UPDATE edges SET field = $3
WHERE field = $2
  AND from_entry IN (SELECT id FROM entries WHERE type_id = ANY($1::uuid[]));
