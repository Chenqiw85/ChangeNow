# Developer Getting Started

This guide is for contributors who want to work on the codebase.

## Repository Layout

```text
frontend/                 Expo React Native app
services/api-go/          Go API and worker
services/ai-py/           Python FastAPI AI service
deploy/                   Docker Compose and Prometheus config
docs/                     Project documentation
```

## Go API

Install dependencies:

```bash
cd services/api-go
go mod download
```

Run tests with the integration harness:

```bash
make test
```

Useful targets:

```bash
make fmt
make vet
make test-up
make test-down
```

Run API locally against local services:

```bash
cd services/api-go
go run ./cmd/api
```

Run worker locally:

```bash
cd services/api-go
go run ./cmd/worker
```

## Python AI Service

Install dependencies:

```bash
cd services/ai-py
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run import check:

```bash
python -c "from app.main import app; print('Import OK')"
```

Run service:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Frontend

Install dependencies:

```bash
cd frontend
npm install
```

Run Expo:

```bash
npm run start
```

Run lint:

```bash
npm run lint
```

## Development Flow

1. Start PostgreSQL and Redis for backend work.
2. Keep `.env` files local and out of git.
3. Update or add tests for handler, middleware, migration, or workflow changes.
4. Run the narrow test command first.
5. Run broader checks before finishing:

```bash
cd services/api-go && make test
cd ../ai-py && python -c "from app.main import app; print('Import OK')"
cd ../../frontend && npm run lint
```

## Current Implementation Notes

- The API applies embedded migrations on startup.
- The Docker Compose file starts the API but not a separate worker service.
- The frontend has some unused imports and hardcoded API base URLs.
- Load scripts reference a Go `/v1/health` endpoint that is not currently registered.

