# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project should use Semantic Versioning once releases are cut.

## [Unreleased]

### Added

- Embedded Go migration runner that applies SQL migrations at API startup and records applied files in `schema_migrations`.
- Migration test coverage for idempotent application, workout log uniqueness, and widened volume precision.
- Go integration test harness with Dockerized PostgreSQL and Redis.
- API rate limiting for unauthenticated register/login routes by client IP.
- Plan-cache warming after worker success.
- Prompt-versioned AI generation using YAML templates.
- Optional LangGraph agent workflow for planner, reviewer, reviser, and formatter steps.

### Changed

- Plan cache keys now include `use_agent`, preventing plain and agent workflow outputs from colliding.
- Rate limit middleware now fails open when Redis is absent in the API process.
- Workout logging now enforces one workout log per user per day via database uniqueness and handler upsert behavior.
- Server assigns workout set numbers instead of trusting client-supplied values.
- Delete-set volume recomputation is scoped to the affected workout log.
- CI workflow runs Go vet/build/tests, Python import validation, and Docker image builds from the correct GitHub Actions path.
- `JWT_SECRET` is required by the Go API at startup.

### Fixed

- Duplicate workout logs are deduplicated before adding the unique `(user_id, performed_at)` constraint.
- `workout_logs.volume` is widened from `numeric(7,2)` to `numeric(10,2)` to avoid overflow on high-volume days.
- Duplicate email registration returns `409 Conflict`.
- JWT parsing rejects unexpected signing methods.
- bcrypt and JWT signing errors are no longer discarded in auth handlers.
- Request contexts are propagated through Go handler database calls.
- Row-scan failures are logged instead of silently ignored.

### Security

- JWTs are signed and validated with HMAC signing methods.
- Auth register/login routes have per-IP rate limiting when Redis is available.
- Authenticated routes have per-user rate limiting when Redis is available.
- Passwords are stored as bcrypt hashes.

## Release Process

When cutting the first release:

1. Move relevant `[Unreleased]` entries into a version section such as `## [0.1.0] - YYYY-MM-DD`.
2. Keep new work under a fresh `[Unreleased]` section.
3. Tag the commit with the same semantic version.

