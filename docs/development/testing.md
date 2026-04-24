# Testing

## Go API Tests

Primary command:

```bash
cd services/api-go
make test
```

`make test` starts PostgreSQL and Redis with Docker Compose, then runs:

```bash
TEST_DATABASE_URL=postgres://test:test@localhost:55432/changenow_test?sslmode=disable \
TEST_REDIS_URL=redis://localhost:56379/0 \
go test -race ./...
```

Covered areas:

- Auth register/login behavior.
- JWT validation and signing method enforcement.
- Rate limiting and fail-open behavior.
- Workout logging and set deletion behavior.
- Migration runner behavior.

## Python AI Service Checks

Current CI validates importability:

```bash
cd services/ai-py
python -c "from app.main import app; print('Import OK')"
```

Recommended additions:

- Unit tests for prompt template rendering.
- Unit tests for JSON extraction in agent formatter.
- Provider-gateway tests with fake providers.
- FastAPI endpoint tests with mocked gateway responses.

## Frontend Checks

Run:

```bash
cd frontend
npm run lint
```

Recommended additions:

- Unit tests for `frontend/lib/plans.ts` JSON cleanup and polling behavior.
- Unit tests for `frontend/lib/api.ts` auth header behavior.
- Screen-level tests for login, plan generation, and workout logging flows.

## Load Tests

k6 scripts live in:

```text
services/api-go/test/load/smoke.js
services/api-go/test/load/stress.js
```

Example:

```bash
cd services/api-go/test/load
BASE_URL=http://localhost:8080 k6 run smoke.js
```

Current caveat: the load scripts call `GET /v1/health`, but the Go API router does not currently register that route. Add a Go health route or update the scripts before treating load tests as passing.

## CI

`.github/workflows/ci.yml` runs:

- PostgreSQL and Redis service containers.
- SQL migrations with `psql`.
- `go vet ./...`.
- API and worker builds.
- `go test -race ./...`.
- Python import check.
- Docker builds for Go API and Python AI images.

