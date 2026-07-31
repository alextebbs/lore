-- name: UpsertDerived :exec
INSERT INTO entry_derived (entry_id, card, digest, search_text, updated_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (entry_id) DO UPDATE
SET card = EXCLUDED.card, digest = EXCLUDED.digest,
    search_text = EXCLUDED.search_text, updated_at = now();

-- name: GetDerived :one
SELECT * FROM entry_derived WHERE entry_id = $1;

-- name: SearchLexical :many
SELECT e.id, e.title, ty.name AS type_name, e.status, d.card,
       ts_rank(to_tsvector('english', d.search_text),
               plainto_tsquery('english', $2))::float8 AS rank,
       similarity(e.title, $2)::float8 AS title_sim
FROM entries e
JOIN entry_derived d ON d.entry_id = e.id
JOIN entry_types ty ON ty.id = e.type_id
WHERE e.world_id = $1
  AND ($3::bool = false OR e.status = 'canon')
ORDER BY rank DESC, title_sim DESC
LIMIT 200;
