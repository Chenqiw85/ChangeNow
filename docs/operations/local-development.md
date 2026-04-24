# Local Development Runtime

This guide is for running the full stack locally.

## Prerequisites

- Docker and Docker Compose.
- Go 1.25 or compatible local toolchain for API development.
- Python 3.12 for AI service development.
- Node.js 18 or newer for the Expo app.
- At least one LLM API key for successful plan generation.

## Environment Files

Create local environment files from examples:

```bash
cp services/api-go/.env.example services/api-go/.env
cp services/ai-py/.env.example services/ai-py/.env
```

Set a real JWT secret:

```bash
openssl rand -hex 32
```

Required API settings:

```dotenv
PORT=8080
DATABASE_URL=postgres://app:app@postgres:5432/changenow?sslmode=disable
JWT_SECRET=<long-random-secret>
```

Required AI settings:

```dotenv
OPENAI_API_KEY=<optional>
ANTHROPIC_API_KEY=<optional>
DEEPSEEK_API_KEY=<optional>
LLM_PROVIDER_PRIORITY=openai,anthropic
```

## Run With Docker Compose

From the repository root:

```bash
docker compose -f deploy/docker-compose.yml up --build
```

Services:

| Service | Local port | Notes |
| --- | --- | --- |
| API | `8080` | Go REST API. |
| AI service | `8001` | Python FastAPI service. |
| PostgreSQL | `5432` | Database `changenow`, user `app`. |
| Redis | `6379` | Queue, cache, rate limits. |
| Prometheus | `9090` | Scrapes API `/metrics`. |
| Grafana | `3000` | Default admin password is `admin` in compose. |

## Run Frontend

In another shell:

```bash
cd frontend
npm install
npm run start
```

The frontend API base URL is hardcoded in `frontend/lib/api.ts`:

- Android emulator: `http://10.0.2.2:8080/v1`
- Other platforms: `http://localhost:8080/v1`

## Useful Checks

AI health:

```bash
curl http://localhost:8001/v1/health
```

API metrics:

```bash
curl http://localhost:8080/metrics
```

Register a user:

```bash
curl -X POST http://localhost:8080/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","password":"hunter2!!"}'
```

## Stop

```bash
docker compose -f deploy/docker-compose.yml down
```

To delete local database and Redis volumes:

```bash
docker compose -f deploy/docker-compose.yml down -v
```

