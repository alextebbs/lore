package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/alextebbs/lore/internal/api"
	"github.com/alextebbs/lore/internal/config"
	"github.com/alextebbs/lore/internal/store"
	"github.com/alextebbs/lore/web"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server exited", "error", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()
	srv := &api.Server{Static: web.Handler()}

	if cfg.DatabaseURL != "" {
		if err := store.Migrate(ctx, cfg.DatabaseURL); err != nil {
			return err
		}
		st, err := store.Open(ctx, cfg.DatabaseURL)
		if err != nil {
			return err
		}
		defer st.Close()
		srv.DB = st.Pool
		slog.Info("database connected, migrations applied")
	} else {
		slog.Warn("DATABASE_URL not set; running without a database")
	}

	httpSrv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: srv.Router(),
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "port", cfg.Port)
		if err := httpSrv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return httpSrv.Shutdown(shutdownCtx)
}
