# Deployment

The repository currently contains Dockerfiles for the Go and Python services plus a Docker Compose stack under `deploy/docker-compose.yml`.

## Build Artifacts

### Go API Image

`services/api-go/Dockerfile` builds both binaries:

- `/app/api`
- `/app/worker`

The image default command starts only the API:

```dockerfile
CMD ["./api"]
```

Deploy the worker as a separate process/container from the same image by overriding the command to:

```bash
./worker
```

### Python AI Image

`services/ai-py/Dockerfile` installs requirements and runs:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Required Runtime Dependencies

- PostgreSQL 16.
- Redis 7.
- Python AI service reachable from the Go worker.
- At least one configured LLM provider key.

## Required API Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | No | Defaults to `8080`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | API exits if missing. |
| `REDIS_URL` | No | Defaults to `redis://localhost:6379/0`; required for queueing to work. |
| `AI_SERVICE_URL` | No | Defaults to `http://localhost:8001`. |

## Required AI Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | One provider key required | Enables OpenAI. |
| `ANTHROPIC_API_KEY` | One provider key required | Enables Anthropic. |
| `DEEPSEEK_API_KEY` | One provider key required | Enables DeepSeek. |
| `LLM_PROVIDER_PRIORITY` | No | Defaults to `openai,anthropic`. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o`. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-20250514`. |
| `DEEPSEEK_MODEL` | No | Defaults to `deepseek-chat`. |
| `LOG_LEVEL` | No | Defaults to `INFO`. |
| `PROMPT_DIR` | No | Defaults to `app/prompts`. |

## Startup Order

Recommended order:

1. PostgreSQL.
2. Redis.
3. AI service.
4. Go API.
5. Go worker.
6. Prometheus and Grafana.

The API applies embedded migrations at startup. The worker expects the database schema to already be present.

## Health And Readiness

Current implemented probes:

- AI service: `GET /v1/health`.
- Go API: `GET /metrics` verifies the HTTP process is reachable.

Current gap:

- No dedicated Go API health endpoint is registered.

## CI

GitHub Actions runs:

- Go vet, API build, worker build, and `go test -race ./...`.
- Python import check.
- Docker builds for both service images.

## Production Notes

- Store `.env` files and secrets outside the repository.
- Run API and worker as separate processes so worker scaling does not affect HTTP capacity.
- Pin public ingress to the Go API only; the Python AI service should be private.
- Configure persistent PostgreSQL storage and backups.
- Configure Redis persistence according to queue-loss tolerance.
- Add a dedicated Go API health endpoint before relying on generic `/metrics` for readiness.

