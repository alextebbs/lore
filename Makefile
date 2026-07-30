# Loads local env if present (cp .env.example .env to start).
-include .env
export

.PHONY: dev dev-web db test build sqlc migrate-new clean

## dev: start Postgres and run the Go server (terminal 1)
dev: db
	go run ./cmd/lore

## dev-web: run the Vite dev server with /api proxied to Go (terminal 2)
dev-web:
	cd web && npm run dev

## db: start Postgres via docker compose and wait until healthy
db:
	docker compose up -d --wait

## test: everything CI runs
test:
	go vet ./...
	go test ./...
	cd web && npm run typecheck

## build: production binary with the SPA embedded
build:
	cd web && npm run build
	go build -o bin/lore ./cmd/lore

## sqlc: regenerate typed queries into internal/store/db
sqlc:
	go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.29.0 generate

## migrate-new name=<snake_case_name>: create a new goose migration
migrate-new:
	@test -n "$(name)" || (echo "usage: make migrate-new name=add_worlds" && exit 1)
	go run github.com/pressly/goose/v3/cmd/goose@v3.27.3 -dir internal/store/migrations create $(name) sql

clean:
	rm -rf bin web/dist/assets
