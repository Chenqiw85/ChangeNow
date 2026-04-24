# ChangeNow Product Requirements

This PRD is drafted from code inference. Items marked "Inferred" should be reviewed by the product owner before treating them as final intent.

## Product Summary

ChangeNow is a mobile-first fitness planning and workout tracking application. Users can create an account, generate AI workout plans from goals and constraints, maintain a personal exercise library, log workout sets, and review workout history.

## Target Users

Confirmed from code:

- Authenticated individual users with email/password accounts.
- Users who want AI-generated weekly workout plans.
- Users who track strength-oriented exercises with weight, reps, sets, volume, and notes.

Inferred:

- Primary audience: general fitness users and beginner-to-intermediate lifters who want guided planning plus lightweight progress tracking.
- Secondary audience: users with equipment or injury constraints who need plan personalization.
- Not currently optimized for clinical rehabilitation, competitive strength athletes, coaches managing many clients, or nutrition-first tracking.

## Problem Statement

Users often need both a plan and a simple way to record what they actually did. ChangeNow reduces planning friction by generating structured workout plans and keeps core workout history close to the plan experience.

## Goals

- Generate a personalized weekly workout plan from a user's goal, days per week, equipment, and constraints.
- Keep plan generation responsive at the API boundary by using async tasks.
- Let users create and manage their own exercise list.
- Let users log sets for exercises and see daily and per-exercise history.
- Preserve enough metadata to audit AI output by prompt and provider/model pipeline.

## Non-Goals

Inferred out of scope for the current product:

- Nutrition planning and calorie intake logging.
- Wearable sync.
- Video coaching, form analysis, or live trainer feedback.
- Social sharing, communities, and plan marketplace features.
- Coach/admin multi-user dashboards.
- Payments and subscriptions.
- Medical diagnosis or rehabilitation prescriptions.

## User Stories

- As a new user, I can register with email and password so I can access my private fitness data.
- As a returning user, I can log in and keep my token stored on the device.
- As a trainee, I can enter a goal, training frequency, equipment, and constraints to generate a workout plan.
- As a trainee, I can see plan-generation progress while the backend works asynchronously.
- As a trainee, I can create custom exercises with a type and description.
- As a trainee, I can log sets with weight and reps for an exercise.
- As a trainee, I can append more sets to today's workout without creating duplicate daily logs.
- As a trainee, I can delete a logged set and see the affected day's volume recomputed.
- As a trainee, I can review exercise history and daily workout history.

## Functional Requirements

### Authentication

- Users register with `email` and `password`.
- Duplicate email registration returns a conflict.
- Passwords are hashed with bcrypt.
- Successful registration and login return a JWT access token.
- JWTs contain `user_id` and expire after 24 hours.

### AI Plan Generation

- Users submit `goal`, `days_per_week`, `equipment`, `constraints`, optional `prompt_version`, and optional `use_agent`.
- `days_per_week` is constrained to 1 through 7.
- Empty `equipment` defaults to `full gym`.
- Empty `constraints` defaults to `none`.
- Empty `prompt_version` defaults to `v1`.
- The API checks Redis for a cached plan before enqueuing work.
- On cache miss, the API creates a task and returns `202 Accepted` with a `task_id`.
- Workers call either the plain AI generation endpoint or agent workflow endpoint.
- Successful worker output is stored in `plans` and best-effort written back to Redis for 24 hours.
- Clients poll task status and fetch the completed plan by ID.

### Exercise Library

- Users can list their exercises.
- Users can create an exercise with name, type, and description.
- Exercise names are unique per user.
- Users can delete their own exercises.

### Workout Logging

- Users can log one or more sets for an exercise.
- The server validates that the exercise belongs to the authenticated user.
- One `workout_logs` row exists per user per day.
- Repeated same-day workout submissions append sets and accumulate volume.
- Set numbers are assigned by the server, not trusted from the client.
- Users can delete individual sets.
- Deleting a set recomputes volume only for the affected workout log.

### History

- Users can fetch history for a single exercise.
- Users can fetch the 20 most recent daily workout logs.
- Users can fetch details for a daily workout log.

## Non-Functional Requirements

- API plan-generation submission should return quickly by enqueuing background work.
- LLM calls have a 120 second client timeout in the Go AI client and task timeout in Asynq.
- Authenticated routes are rate-limited to 10 requests per minute per user when Redis is available.
- Public auth routes are rate-limited to 20 requests per minute per IP when Redis is available.
- Rate limiting fails open if Redis is unavailable in the API process.
- Prometheus metrics cover HTTP request count, HTTP latency, LLM requests, LLM latency, tokens, cache hit/miss, and rate-limit rejections.
- Request IDs are propagated from the Go API to the Python AI service.

## Success Metrics

Confirmed instrumentation:

- HTTP request count by method, route, and status.
- HTTP request latency histogram.
- LLM request count by provider and status.
- LLM latency histogram by provider.
- Total LLM tokens by provider.
- Cache hit/miss count.
- Rate-limit rejection count.

Inferred product metrics to add:

- Plan-generation start-to-completion rate.
- Plan-generation failure rate by provider and workflow mode.
- p95 plan task duration from `created_at` to `finished_at`.
- Workout-log weekly active users.
- Exercise creation rate.
- Plan-to-workout conversion rate.

## Open Product Questions

- Should `created_at` supplied by the workout logging request be honored? The current handler always uses `CURRENT_DATE`.
- Should plan outputs be stored as JSONB instead of text once the schema stabilizes?
- Should generated plans be listed per user, or only fetched by known plan ID?
- Should the AI agent workflow become the default, or remain opt-in via `use_agent`?
- Should calories be user-entered, calculated, or removed until implemented?

