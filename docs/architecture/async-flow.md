# Async Plan-Generation Flow

Plan generation is asynchronous because LLM calls can be slow. The Go API returns a task ID quickly, while the Go worker performs the expensive work in the background.

## Sequence

```mermaid
sequenceDiagram
  participant App as Expo app
  participant API as Go API
  participant Redis as Redis / Asynq
  participant Worker as Go worker
  participant AI as Python AI service
  participant PG as PostgreSQL

  App->>API: POST /v1/plans/generate
  API->>Redis: Get plan cache
  alt cache hit
    API-->>App: 200 cached plan JSON
  else cache miss
    API->>PG: INSERT tasks(status=pending)
    API->>Redis: Enqueue plan:generate
    API-->>App: 202 task_id
    Worker->>Redis: Dequeue plan:generate
    Worker->>PG: UPDATE task status=running
    Worker->>AI: POST /v1/generate or /v1/generate/agent
    AI-->>Worker: plan_text + provider metadata
    Worker->>PG: INSERT plans
    Worker->>Redis: Set cached plan, ttl 24h
    Worker->>PG: UPDATE task status=done, plan_id
    App->>API: GET /v1/tasks/:id
    API-->>App: status=done, plan_id
    App->>API: GET /v1/plans/:id
    API-->>App: plan_text
  end
```

## Task States

| State | Writer | Meaning |
| --- | --- | --- |
| `pending` | API | Task row created and queued. |
| `running` | Worker | Worker has started processing. |
| `done` | Worker | Plan was persisted and task has `plan_id`. |
| `failed` | Worker | AI call failed; `error_message` is set. |

## Cache Behavior

The cache key is generated from:

- user ID
- goal
- days per week
- equipment
- constraints
- prompt version
- `use_agent`

The `use_agent` flag is included because the plain generator and agent workflow can produce different artifacts for the same visible inputs.

Cache hits return a JSON body with:

```json
{
  "id": "plan-uuid",
  "plan_text": "..."
}
```

Cache misses enqueue a task and return:

```json
{
  "task_id": "task-uuid",
  "status": "pending",
  "message": "Plan generation started. Poll GET /v1/tasks/:id for status."
}
```

## Failure Modes

- Redis unavailable in API: rate limiting and cache are disabled, but Asynq still requires a valid `REDIS_URL` client setup.
- Queue enqueue failure: API returns `500 failed to enqueue task` after inserting the task row.
- AI service failure: worker marks the task `failed`, stores `error_message`, and returns an error to Asynq for retry.
- Plan insert failure: worker returns an error; Asynq retries.
- Cache write failure after plan insert: worker logs a warning and still marks the task done.

## Timeouts And Retries

- Go AI client timeout: 120 seconds.
- Asynq task timeout: 120 seconds.
- Asynq max retry: 3.
- Worker concurrency: 5.

