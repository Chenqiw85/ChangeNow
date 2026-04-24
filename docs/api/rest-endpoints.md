# Go REST Endpoints

Base URL in local development is usually `http://localhost:8080`. Versioned API routes live under `/v1`. The metrics endpoint is unversioned at `/metrics`.

## Authentication

Authenticated endpoints require:

```http
Authorization: Bearer <jwt>
```

JWTs are issued by register/login and include `user_id` plus a 24 hour expiration.

## Rate Limits

When Redis is available:

- Public auth routes: 20 requests per minute per client IP.
- Authenticated routes: 10 requests per minute per user.

When Redis is unavailable in the API process, rate limiting fails open.

## Endpoint Summary

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/metrics` | No | Prometheus metrics. |
| `POST` | `/v1/auth/register` | No | Create account and return token. |
| `POST` | `/v1/auth/login` | No | Authenticate and return token. |
| `POST` | `/v1/plans/generate` | Yes | Start or retrieve cached plan generation. |
| `GET` | `/v1/tasks/:id` | Yes | Read async task status. |
| `GET` | `/v1/plans/:id` | Yes | Read generated plan text. |
| `GET` | `/v1/exercises` | Yes | List current user's exercises. |
| `POST` | `/v1/exercises` | Yes | Create an exercise. |
| `DELETE` | `/v1/exercises/:id` | Yes | Delete an exercise. |
| `POST` | `/v1/workouts` | Yes | Log workout sets. |
| `DELETE` | `/v1/workouts/:id` | Yes | Delete a workout set. |
| `GET` | `/v1/exercises/:id/history` | Yes | Get history for one exercise. |
| `GET` | `/v1/exercises/history` | Yes | Get recent daily workout logs. |
| `GET` | `/v1/exercises/:id/details` | Yes | Get set details for a workout log ID. |

There is no Go API `/v1/health` route in the current router.

## Auth Endpoints

### `POST /v1/auth/register`

Request:

```json
{
  "email": "alice@example.com",
  "password": "hunter2!!"
}
```

Validation:

- `email` is required and must be email-shaped.
- `password` is required and minimum length is 6.

Success `201`:

```json
{
  "id": 1,
  "email": "alice@example.com",
  "access_token": "<jwt>"
}
```

Errors:

- `400` invalid body.
- `409` duplicate email.
- `500` hash, insert, or token issue failure.

### `POST /v1/auth/login`

Request:

```json
{
  "email": "alice@example.com",
  "password": "hunter2!!"
}
```

Success `200`:

```json
{
  "access_token": "<jwt>"
}
```

Errors:

- `400` invalid body.
- `401` invalid credentials.
- `500` token issue failure.

## Plan Endpoints

### `POST /v1/plans/generate`

Starts async plan generation, unless an identical request is already cached.

Request:

```json
{
  "goal": "Build muscle and lose fat",
  "days_per_week": 4,
  "equipment": "full gym",
  "constraints": "none",
  "prompt_version": "v1",
  "use_agent": false
}
```

Fields:

| Field | Required | Notes |
| --- | --- | --- |
| `goal` | Yes | Free text. |
| `days_per_week` | Yes | Integer 1 through 7. |
| `equipment` | No | Defaults to `full gym`. |
| `constraints` | No | Defaults to `none`. |
| `prompt_version` | No | Defaults to `v1`. |
| `preferred_provider` | No | Accepted by the Go request struct but not currently propagated to the worker. |
| `use_agent` | No | If true, worker calls the LangGraph agent endpoint. |

Cache-hit success `200`:

```json
{
  "id": "8f9736e1-a7b7-44c6-a9a1-a77ccde226d4",
  "plan_text": "{\"plan_name\":\"...\"}"
}
```

Cache-miss success `202`:

```json
{
  "task_id": "6e4432aa-d540-46d0-af85-e7a76f48e2cc",
  "status": "pending",
  "message": "Plan generation started. Poll GET /v1/tasks/:id for status."
}
```

Errors:

- `400` invalid body.
- `500` task insert, task creation, or enqueue failure.

### `GET /v1/tasks/:id`

Reads async task status.

Success `200`:

```json
{
  "id": "6e4432aa-d540-46d0-af85-e7a76f48e2cc",
  "status": "done",
  "plan_id": "8f9736e1-a7b7-44c6-a9a1-a77ccde226d4"
}
```

Failure status example:

```json
{
  "id": "6e4432aa-d540-46d0-af85-e7a76f48e2cc",
  "status": "failed",
  "error_message": "AI service call failed: ..."
}
```

Errors:

- `400` invalid UUID.
- `404` task not found.

Current implementation note: the handler looks up tasks by ID only and does not filter by authenticated `user_id`.

### `GET /v1/plans/:id`

Reads plan text.

Success `200`:

```json
{
  "id": "8f9736e1-a7b7-44c6-a9a1-a77ccde226d4",
  "plan_text": "{\"plan_name\":\"...\"}"
}
```

Errors:

- `400` invalid UUID.
- `404` plan not found.

Current implementation note: the handler looks up plans by ID only and does not filter by authenticated `user_id`.

## Exercise Endpoints

### `GET /v1/exercises`

Lists exercises for the authenticated user.

Success `200`:

```json
{
  "exercises": [
    {
      "id": 1,
      "name": "Bench Press",
      "type": "Strength training",
      "description": "",
      "created_at": "2026-04-24T12:00:00Z"
    }
  ]
}
```

### `POST /v1/exercises`

Request:

```json
{
  "name": "Bench Press",
  "type": "Strength training",
  "description": "Barbell flat bench"
}
```

Defaults:

- Empty `type` becomes `Strength training`.

Success `201` returns the created exercise object.

Errors:

- `400` invalid body.
- `409` duplicate exercise name or insert failure.

### `DELETE /v1/exercises/:id`

Deletes an exercise owned by the authenticated user.

Success `200`:

```json
{
  "deleted": true
}
```

Errors:

- `404` not found or not owned by user.
- `500` delete failure.

## Workout Endpoints

### `POST /v1/workouts`

Logs sets for an exercise. The handler currently uses `CURRENT_DATE` in SQL; request `created_at` is declared but not used.

Request:

```json
{
  "exercise_id": 1,
  "notes": "Felt strong",
  "sets": [
    { "weight": 100, "reps": 5 },
    { "weight": 105, "reps": 5 }
  ]
}
```

Success `201`:

```json
{
  "workout_log_id": 10
}
```

Behavior:

- Verifies the exercise belongs to the user.
- Upserts one workout log per user per current date.
- Adds submitted volume to daily volume.
- Server assigns sequential `set_number` values per workout log and exercise.

Errors:

- `400` invalid body.
- `404` exercise not found or not owned by user.
- `500` transaction, upsert, insert, or commit failure.

### `DELETE /v1/workouts/:id`

Deletes a single workout set by set ID.

Success `200`:

```json
{
  "deleted": true
}
```

Behavior:

- Set must belong to a workout log owned by the authenticated user.
- Recomputes `workout_logs.volume` for the affected log only.

Errors:

- `404` set not found or not owned by user.
- `500` delete or volume update failure.

### `GET /v1/exercises/:id/history`

Returns set history for a single exercise ID.

Success `200`:

```json
{
  "history": [
    {
      "workout_log_id": 10,
      "exercise_id": 1,
      "exercise_name": "Bench Press",
      "exercise_type": "Strength training",
      "created_at": "2026-04-24T12:00:00Z",
      "sets": [
        {
          "id": 50,
          "set_number": 1,
          "weight": 100,
          "reps": 5
        }
      ]
    }
  ]
}
```

### `GET /v1/exercises/history`

Returns the authenticated user's 20 most recent daily workout logs.

Success `200`:

```json
{
  "history": [
    {
      "id": 10,
      "volume": 1025,
      "calories": 0,
      "performed_at": "2026-04-24T00:00:00Z",
      "notes": "Felt strong"
    }
  ]
}
```

### `GET /v1/exercises/:id/details`

Despite the route name, `:id` is a workout log ID, not an exercise ID. It returns all sets grouped by exercise for that workout log.

Success shape matches `GET /v1/exercises/:id/history`.

## Metrics

### `GET /metrics`

Prometheus scrape endpoint. Registered before request ID, logging, and metrics middleware.

