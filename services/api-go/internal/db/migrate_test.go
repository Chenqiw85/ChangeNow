package db_test

import (
	"context"
	"testing"

	"changenow/api-go/internal/db"
	"changenow/api-go/internal/logger"
	"changenow/api-go/internal/testutil"
)

func TestMain(m *testing.M) {
	logger.Init()
	m.Run()
}

// TestRun verifies the migration runner applies every embedded migration,
// records each filename in schema_migrations, and is safe to call twice.
func TestRun(t *testing.T) {
	pool := testutil.PGPool(t)
	ctx := context.Background()

	// Drop the tracking table so we observe a fresh apply. Every migration
	// is idempotent, so the schema itself is already in the target state
	// from the docker-entrypoint-initdb.d path — this test exercises the
	// runner's bookkeeping and idempotence, not schema creation.
	if _, err := pool.Exec(ctx, `DROP TABLE IF EXISTS schema_migrations`); err != nil {
		t.Fatalf("drop schema_migrations: %v", err)
	}

	if err := db.Run(ctx, pool); err != nil {
		t.Fatalf("first Run: %v", err)
	}

	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil {
		t.Fatalf("count schema_migrations: %v", err)
	}
	if count < 4 {
		t.Fatalf("expected at least 4 migrations recorded, got %d", count)
	}

	// Second run must be a no-op that touches no rows.
	if err := db.Run(ctx, pool); err != nil {
		t.Fatalf("second Run: %v", err)
	}
	var recount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM schema_migrations`).Scan(&recount); err != nil {
		t.Fatalf("re-count schema_migrations: %v", err)
	}
	if recount != count {
		t.Fatalf("second Run changed row count: %d -> %d", count, recount)
	}

	// Migration 004 must have widened workout_logs.volume to numeric(10,2).
	var precision, scale int
	if err := pool.QueryRow(ctx, `
		SELECT numeric_precision, numeric_scale
		FROM information_schema.columns
		WHERE table_name = 'workout_logs' AND column_name = 'volume'
	`).Scan(&precision, &scale); err != nil {
		t.Fatalf("inspect volume column: %v", err)
	}
	if precision != 10 || scale != 2 {
		t.Fatalf("workout_logs.volume precision/scale = %d/%d, want 10/2", precision, scale)
	}

	// 003's unique constraint must be present.
	var hasUnique bool
	if err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conname = 'workout_logs_user_day_unique'
		)
	`).Scan(&hasUnique); err != nil {
		t.Fatalf("check unique constraint: %v", err)
	}
	if !hasUnique {
		t.Fatal("workout_logs_user_day_unique is missing after Run")
	}
}
