# 0002: Use Async Plan Generation

## Status

Accepted.

## Context

LLM-backed plan generation can take many seconds and may require retries. Keeping a mobile client request open for the whole generation path would make the API more fragile under provider latency.

## Decision

Use an async task model:

- `POST /v1/plans/generate` creates a task and enqueues `plan:generate`.
- The worker calls the AI service and stores a plan.
- The client polls `GET /v1/tasks/:id` and then fetches `GET /v1/plans/:id`.

## Consequences

- Plan submission can return quickly with `202 Accepted`.
- Task status is durable in PostgreSQL.
- Worker retries are handled by Asynq.
- Clients need polling behavior.
- A failed enqueue can leave a pending task row that never runs; operational checks should watch stale pending tasks.

