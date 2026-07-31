// Package store owns all Postgres access: the connection pool, embedded
// goose migrations (run at startup), and the sqlc-generated queries in
// store/db. Postgres is the only datastore (ADR 0006).
package store

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/alextebbs/lore/internal/store/db"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type Store struct {
	Pool    *pgxpool.Pool
	Queries *db.Queries
}

// Open connects, pings, and returns a Store. It does not migrate; call
// Migrate explicitly so startup order is visible in main.
func Open(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("creating pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}
	return &Store{Pool: pool, Queries: db.New(pool)}, nil
}

// Migrate applies embedded goose migrations. goose needs database/sql, so
// it gets its own short-lived stdlib connection.
func Migrate(ctx context.Context, databaseURL string) error {
	sqlDB, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("opening migration connection: %w", err)
	}
	defer sqlDB.Close()

	goose.SetBaseFS(migrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	if err := goose.UpContext(ctx, sqlDB, "migrations"); err != nil {
		return fmt.Errorf("applying migrations: %w", err)
	}
	return nil
}

func (s *Store) Close() {
	s.Pool.Close()
}

// Tx runs fn inside a transaction with transactional Queries.
func (s *Store) Tx(ctx context.Context, fn func(q *db.Queries) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning tx: %w", err)
	}
	defer tx.Rollback(ctx)
	if err := fn(s.Queries.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
