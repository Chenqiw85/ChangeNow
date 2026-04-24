# Security

This document describes the current security model and known gaps.

## Authentication

- Users authenticate with email and password.
- Passwords are hashed with bcrypt.
- JWTs are signed with `JWT_SECRET`.
- JWTs include `user_id` and a 24 hour expiration.
- Auth middleware requires `Authorization: Bearer <token>`.
- Auth middleware rejects tokens with unexpected HMAC signing methods.

## Authorization

Implemented owner checks:

- Exercise list filters by authenticated `user_id`.
- Exercise creation attaches authenticated `user_id`.
- Exercise deletion filters by exercise ID and `user_id`.
- Workout logging verifies the exercise belongs to the authenticated user.
- Workout set deletion verifies the set belongs to a workout log owned by the user.
- Exercise and workout history queries join through user-owned workout logs.

Known gaps:

- `GET /v1/tasks/:id` does not currently filter by authenticated `user_id`.
- `GET /v1/plans/:id` does not currently filter by authenticated `user_id`.
- `tasks.plan_id` has no foreign key to `plans(id)`.

## Rate Limiting

When Redis is available:

- Register/login routes are limited to 20 requests per minute per client IP.
- Authenticated routes are limited to 10 requests per minute per user.
- Rejections return `429` and include `retry_after_seconds`.

If Redis is unavailable in the API process, rate limiting fails open to avoid locking users out.

## Secret Management

Required secrets:

- `JWT_SECRET`
- At least one LLM provider API key for generation.

Rules:

- Do not commit `.env` files.
- Generate `JWT_SECRET` with sufficient entropy, for example `openssl rand -hex 32`.
- Rotate provider API keys if they appear in logs, screenshots, commits, or tickets.
- Keep the Python AI service private; expose the Go API publicly.

## Data Protection

Stored sensitive data:

- Email addresses.
- Password hashes.
- Fitness goals, constraints, exercise logs, and generated plans.

Current controls:

- Passwords are not stored in plaintext.
- User-owned exercise and workout writes are scoped by authenticated user.
- PostgreSQL foreign keys cascade user-owned data on user deletion.

Recommended controls before production:

- Add owner checks to task and plan read endpoints.
- Add TLS at ingress.
- Add database backups and restore testing.
- Add structured audit logging for account and plan access.
- Review LLM data retention settings for each provider.
- Avoid logging full prompt bodies or generated plans in production.

## AI Safety Boundaries

The AI prompts ask for safe, personalized workout plans and include user constraints. The optional agent workflow includes a reviewer node that checks safety, completeness, balance, and JSON validity.

Product boundary:

- Generated plans should be treated as fitness guidance, not medical advice.
- Clinical rehabilitation, diagnosis, injury treatment, and emergency guidance are out of scope unless reviewed by qualified professionals.

## Dependency And Supply Chain

Current automated checks:

- Go vet.
- Go tests with race detector.
- Python import check.
- Docker image builds.

Recommended additions:

- Dependency vulnerability scanning.
- Container image scanning.
- Static analysis for Python and TypeScript.
- Secret scanning in CI.

