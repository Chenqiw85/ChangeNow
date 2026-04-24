# Runbook

This runbook focuses on the current Docker Compose and service layout.

## API Will Not Start

Symptoms:

- API container exits.
- Logs include `JWT_SECRET is empty` or `DATABASE_URL is empty`.

Checks:

```bash
docker compose -f deploy/docker-compose.yml logs api
```

Actions:

- Ensure `services/api-go/.env` exists.
- Ensure `JWT_SECRET` is set to a long random value.
- Ensure `DATABASE_URL` points at PostgreSQL.
- Check PostgreSQL health.

## Migrations Fail

Symptoms:

- API exits with `apply migrations`.
- Database schema is partially applied.

Checks:

```sql
select * from schema_migrations order by applied_at;
```

Actions:

- Read the failing migration in `services/api-go/migrations/`.
- Verify the migration is idempotent.
- Restore from backup if a failed manual change left the schema inconsistent.
- Re-run the API after the schema issue is corrected.

## Plan Generation Stays Pending

Symptoms:

- `POST /v1/plans/generate` returns `202`.
- `GET /v1/tasks/:id` remains `pending`.

Checks:

```bash
docker compose -f deploy/docker-compose.yml logs api
docker compose -f deploy/docker-compose.yml logs redis
```

Also confirm a worker process is running. The provided compose file builds the worker binary but does not define a separate worker service.

Actions:

- Start a worker container/process from the Go image with command `./worker`.
- Confirm `REDIS_URL`, `DATABASE_URL`, and `AI_SERVICE_URL` are correct for the worker.
- Check Redis health.

## Plan Generation Fails

Symptoms:

- Task status becomes `failed`.
- `error_message` references AI service or provider failure.

Checks:

```bash
curl http://localhost:8001/v1/health
docker compose -f deploy/docker-compose.yml logs ai-service
```

Actions:

- Ensure at least one LLM API key is configured.
- Check `LLM_PROVIDER_PRIORITY` only names supported providers: `openai`, `anthropic`, `deepseek`.
- Check provider quota, network access, and model names.
- Retry with `use_agent=false` if the agent workflow is failing but plain generation is acceptable.

## Redis Is Down

Symptoms:

- API logs `Redis not available, caching and rate limiting disabled`.
- Worker may exit with `redis for worker cache`.
- Plan generation may fail to enqueue or process.

Actions:

- Restart Redis.
- Verify `REDIS_URL`.
- Restart API so cache/rate-limit client is reinitialized.
- Restart worker.

## Rate Limits Trigger Unexpectedly

Symptoms:

- API returns `429`.
- Response includes `retry_after_seconds`.

Actions:

- Inspect `X-RateLimit-*` headers.
- Confirm clients are not retrying too aggressively.
- For auth routes, remember limit is per IP.
- For authenticated routes, remember limit is per user.
- Flush Redis only in local/test environments.

## Workout Volume Looks Wrong

Symptoms:

- Daily volume does not match visible sets.

Checks:

```sql
select id, user_id, performed_at, volume
from workout_logs
order by performed_at desc
limit 20;
```

```sql
select workout_log_id, sum(weight * reps) as computed_volume
from workout_sets
group by workout_log_id;
```

Actions:

- Compare stored `workout_logs.volume` to computed set volume.
- Deleting a set recomputes the affected log.
- If manual correction is needed, update the single affected log from `workout_sets`.

