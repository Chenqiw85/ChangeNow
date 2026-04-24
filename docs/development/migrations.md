# Migrations

Database migrations live in `services/api-go/migrations/`.

## How Migrations Are Applied

The Go API calls the embedded migration runner during startup:

```go
if err := db.Run(context.Background(), pool); err != nil {
    log.Fatalf("apply migrations: %v", err)
}
```

The runner:

- Reads embedded `.sql` files.
- Sorts files lexically.
- Creates `schema_migrations`.
- Takes a session-level advisory lock.
- Applies migrations not yet recorded.
- Inserts each applied filename into `schema_migrations`.

## Naming

Use a zero-padded numeric prefix and a short description:

```text
005_add_user_profile_fields.sql
006_add_plan_feedback.sql
```

## Idempotence

Migrations should be safe to apply in environments that may already contain the desired schema change. Current examples:

- `001_init.sql` wraps enum creation in a `DO` block.
- `003_workout_logs_unique_day.sql` checks for the unique constraint before adding it.
- `004_workout_logs_volume_widen.sql` is safe to re-run once the type is already `numeric(10,2)`.

## Writing A Migration

1. Create a new SQL file under `services/api-go/migrations/`.
2. Make the change idempotent when PostgreSQL supports a clean check.
3. Include data backfill or deduplication before adding constraints that depend on existing data.
4. Add or update tests in `services/api-go/internal/db/migrate_test.go` when the migration changes important schema guarantees.
5. Run:

```bash
cd services/api-go
make test
```

## Testing A Fresh Apply

The test database compose file mounts migrations into `/docker-entrypoint-initdb.d`, so a fresh test volume receives the migration files on initialization.

```bash
cd services/api-go
make test-down
make test-up
make test
```

## Inspect Applied Migrations

```sql
select filename, applied_at
from schema_migrations
order by filename;
```

## Rollbacks

Rollback files are not currently part of the migration system. To undo a deployed migration, write a new forward migration that returns the schema/data to the desired state.

