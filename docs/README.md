# ChangeNow Documentation

This directory is the project documentation index. It reflects the current repository state: a Go REST API, a Python AI service, a PostgreSQL database, Redis-backed cache and queueing, Prometheus metrics, and an Expo React Native app.

## Product And Data

- [Product requirements](PRD.md)
- [Database schema and migrations](DATABASE.md)
- [Changelog](CHANGELOG.md)
- [Security model](security.md)

## Architecture

- [Architecture overview](architecture/overview.md)
- [Async plan-generation flow](architecture/async-flow.md)
- [Architecture decisions](architecture/decisions/)

## API

- [Go REST endpoints](api/rest-endpoints.md)
- [Python AI service](api/ai-service.md)

## Operations

- [Local development runtime](operations/local-development.md)
- [Deployment](operations/deployment.md)
- [Observability](operations/observability.md)
- [Runbook](operations/runbook.md)

## Development

- [Getting started](development/getting-started.md)
- [Migrations](development/migrations.md)
- [Testing](development/testing.md)
- [Prompt versioning](development/prompt-versioning.md)

## Source Of Truth

- API routes: `services/api-go/internal/http/routes.go`
- Go handlers: `services/api-go/internal/http/handlers/`
- Database migrations: `services/api-go/migrations/`
- Migration runner: `services/api-go/internal/db/migrate.go`
- AI endpoints: `services/ai-py/app/main.py`
- Prompt templates: `services/ai-py/app/prompts/`
- Frontend API clients: `frontend/lib/`

