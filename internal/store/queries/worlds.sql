-- name: CreateWorld :one
INSERT INTO worlds (id, owner_id, name)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetWorld :one
SELECT * FROM worlds WHERE id = $1;

-- name: ListWorlds :many
SELECT * FROM worlds WHERE owner_id = $1 ORDER BY created_at;

-- name: CreateEntryType :one
INSERT INTO entry_types (id, world_id, name, parent_id, fields, builtin)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListEntryTypes :many
SELECT * FROM entry_types WHERE world_id = $1 ORDER BY builtin DESC, name;

-- name: GetEntryType :one
SELECT * FROM entry_types WHERE id = $1;

-- name: UpdateWorldSettings :one
UPDATE worlds SET settings = $2 WHERE id = $1 RETURNING *;

-- name: DeleteWorld :exec
DELETE FROM worlds WHERE id = $1;

-- name: GetEntryByTitle :one
SELECT id FROM entries WHERE world_id = $1 AND lower(title) = lower($2) LIMIT 1;

-- name: UpdateEntryTypeRow :one
UPDATE entry_types SET name = $2, fields = $3 WHERE id = $1 RETURNING *;
