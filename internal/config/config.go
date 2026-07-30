// Package config loads server configuration from the environment.
// Env is the only configuration source (ADR 0009: one binary, one app).
package config

import "os"

type Config struct {
	// Port the HTTP server listens on.
	Port string
	// DatabaseURL is a pgx connection string. Empty means no database,
	// which the server tolerates during early scaffolding.
	DatabaseURL string
}

func Load() Config {
	return Config{
		Port:        getenv("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
