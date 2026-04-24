// Package db owns database bootstrap: applying embedded SQL migrations at
// startup so the app schema stays in lockstep with the binary.
//
// Migrations are embedded (see ../../migrations/migrations.go) so the binary
// is self-contained and the docker-entrypoint-initdb.d path (fresh-volume
// only) is no longer the sole trigger. A session-level pg_advisory_lock
// serializes concurrent startups so two replicas don't race applying the
// same migration. schema_migrations records applied filenames; files are
// applied in lexical order and expected to be idempotent so a re-run
// against a DB that already holds the target state is a no-op.
package db

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"changenow/api-go/internal/logger"
	"changenow/api-go/migrations"
)

// advisoryLockKey is an arbitrary 64-bit constant. Any fixed int64 works as
// long as it doesn't collide with another advisory lock used elsewhere.
const advisoryLockKey int64 = 0x6368676E6D677274 // "chgnmgrt"

// Run applies any embedded migrations that have not yet been recorded in
// schema_migrations. Safe to call on every startup.
func Run(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire conn: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, advisoryLockKey); err != nil {
		return fmt.Errorf("acquire advisory lock: %w", err)
	}
	defer func() {
		// Use Background so the unlock isn't skipped if ctx is already done.
		if _, err := conn.Exec(context.Background(), `SELECT pg_advisory_unlock($1)`, advisoryLockKey); err != nil {
			logger.Log.Warn("release migration advisory lock", zap.Error(err))
		}
	}()

	if _, err := conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename    TEXT PRIMARY KEY,
			applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	applied := map[string]struct{}{}
	rows, err := conn.Query(ctx, `SELECT filename FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("read schema_migrations: %w", err)
	}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return fmt.Errorf("scan schema_migrations row: %w", err)
		}
		applied[name] = struct{}{}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate schema_migrations: %w", err)
	}

	files, err := listMigrations()
	if err != nil {
		return err
	}

	for _, name := range files {
		if _, ok := applied[name]; ok {
			continue
		}

		sqlBytes, err := migrations.FS.ReadFile(name)
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}

		logger.Log.Info("applying migration", zap.String("file", name))
		if _, err := conn.Exec(ctx, string(sqlBytes)); err != nil {
			return fmt.Errorf("apply %s: %w", name, err)
		}

		if _, err := conn.Exec(ctx,
			`INSERT INTO schema_migrations (filename) VALUES ($1)
			 ON CONFLICT (filename) DO NOTHING`,
			name,
		); err != nil {
			return fmt.Errorf("record %s: %w", name, err)
		}
	}

	return nil
}

func listMigrations() ([]string, error) {
	entries, err := migrations.FS.ReadDir(".")
	if err != nil {
		return nil, fmt.Errorf("list embedded migrations: %w", err)
	}
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(name, ".sql") {
			continue
		}
		out = append(out, name)
	}
	sort.Strings(out)
	return out, nil
}
