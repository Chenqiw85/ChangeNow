# ChangeNow — AI Fitness Planning Platform

An AI-powered fitness planning platform that generates personalized workout plans using a multi-step agent workflow. Built with a **Go API backend**, **Python AI microservice**, and **React Native frontend**.

## Architecture Overview

```
┌──────────────┐     ┌──────────────────────────────────────────────┐
│  React Native │     │                 Go API Layer                 │
│   (Expo)      │────▶│  Gin Router → JWT Auth → Rate Limiter       │
│  Mobile App   │     │       │                                      │
└──────────────┘     │       ▼                                      │
                      │  ┌──────────┐   ┌───────┐   ┌────────────┐ │
                      │  │ Handlers │──▶│ Asynq │──▶│   Worker   │ │
                      │  └──────────┘   │ Queue │   │  (async)   │ │
                      │       │         └───┬───┘   └─────┬──────┘ │
                      │       ▼             │             │        │
                      │  ┌──────────┐   ┌───▼───┐        │        │
                      │  │PostgreSQL│   │ Redis │        │        │
                      │  │  (data)  │   │(cache)│        │        │
                      │  └──────────┘   └───────┘        │        │
                      └──────────────────────────────────┼────────┘
                                                         │
                      ┌──────────────────────────────────▼────────┐
                      │          Python AI Microservice            │
                      │                                            │
                      │  ┌────────────────────────────────────┐   │
                      │  │          LLM Gateway                │   │
                      │  │   OpenAI ←→ Automatic Fallback ←→ Claude│
                      │  └────────────────┬───────────────────┘   │
                      │                   │                        │
                      │  ┌────────────────▼───────────────────┐   │
                      │  │      LangGraph Agent Workflow       │   │
                      │  │  Planner → Reviewer → Reviser →     │   │
                      │  │               Formatter             │   │
                      │  └────────────────────────────────────┘   │
                      │                                            │
                      │  ┌────────────────────────────────────┐   │
                      │  │    Prompt Version Manager (YAML)    │   │
                      │  └────────────────────────────────────┘   │
                      └────────────────────────────────────────────┘
                      
                      ┌────────────────────────────────────────────┐
                      │             Observability                   │
                      │  Prometheus (metrics) → Grafana (dashboards)│
                      │  Zap (structured logs) + X-Request-ID       │
                      └────────────────────────────────────────────┘
```

## Key Features

### AI Infrastructure
- **LLM Gateway** with provider-agnostic interface supporting OpenAI and Anthropic Claude, with automatic failover between providers
- **Multi-step Agent Workflow** using LangGraph: Planner → Reviewer → Reviser (conditional loop) → Formatter
- **Versioned Prompt Templates** stored as YAML files, supporting per-request version selection and A/B testing

### Backend (Go)
- **Gin-based REST API** with JWT authentication and role-based access
- **Async Task Queue** using Asynq with Redis backend, configurable retries, and 120s timeout per task
- **Redis Caching** with SHA256-based cache keys for plan deduplication
- **Sliding Window Rate Limiting** at 10 requests/min per user using Redis Sorted Sets
- **Graceful Shutdown** with SIGTERM handling and 30s drain period

### Observability
- **Structured Logging** with Zap (JSON format in production, human-readable in development)
- **Distributed Tracing** via X-Request-ID propagated across Go and Python services
- **Prometheus Metrics** — HTTP request rate, P95 latency, LLM token consumption, cache hit rate, rate limit rejections, provider fallback frequency
- **Grafana Dashboards** with 6 monitoring panels for real-time system health

### Frontend (React Native)
- **Expo / React Native** mobile app with TypeScript
- Tab-based navigation (Dashboard, Exercise, History, User)
- JWT token storage via SecureStore (mobile) / localStorage (web)

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React Native, Expo, TypeScript, React Navigation |
| API | Go, Gin, pgxpool, JWT, Asynq |
| AI Service | Python, FastAPI, LangGraph, LangChain Core |
| LLM Providers | OpenAI GPT-4o, Anthropic Claude |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| Observability | Prometheus, Grafana, Zap, Swagger/OpenAPI |
| Infrastructure | Docker, Docker Compose, GitHub Actions CI/CD |
| Testing | k6 (load testing) |

## Getting Started

### Prerequisites

- Go 1.25+
- Python 3.12+
- Docker & Docker Compose
- Node.js 18+ (for frontend)
- At least one LLM API key (OpenAI or Anthropic)

## Design Decisions

### Why Go + Python (not a single language)?
Go handles HTTP routing, authentication, and database operations with high concurrency and low memory footprint. Python owns the AI layer because LangGraph, LangChain, and all major LLM SDKs are Python-first. The two services communicate via HTTP — clean separation of concerns.

### Why a separate LLM Gateway instead of calling OpenAI directly?
The Gateway provides: (1) automatic failover between providers, (2) a unified interface so business logic doesn't depend on any specific SDK, (3) a single place to add logging, metrics, and rate limiting for all LLM calls. Adding a new provider requires implementing 3 methods and one line of registration.

### Why LangGraph instead of simple prompt chaining?
A single LLM call can't self-correct. The agent workflow lets the Reviewer catch unsafe exercises (e.g., heavy squats for someone with a knee injury), and the Reviser fixes them. The conditional loop means plans are only revised when needed — most pass on the first try.

### Why async task queue instead of synchronous API?
LLM calls take 30-60 seconds. A synchronous API would hold connections open, exhaust worker threads, and timeout under load. The async pattern returns a task ID in <200ms, and the worker processes tasks independently with automatic retries.

### Why YAML prompt templates instead of hardcoded strings?
Prompts are the most frequently iterated part of an AI application. File-based versioning allows: (1) rollback to previous versions, (2) A/B testing by routing different users to different versions, (3) audit trail via the `prompt_version` field stored with every generated plan.


### Benchmark Results (reference)

| Metric | 10 Users | 50 Users | 100 Users |
|--------|----------|----------|-----------|
| Throughput | ~15 req/s | ~40 req/s | ~65 req/s |
| P95 Latency (API) | 180ms | 350ms | 890ms |
| P95 Latency (with LLM) | 8s | 15s | 30s |
| Error Rate | <0.1% | <0.5% | ~1.2% |

> Note: LLM latency is dominated by provider response time. API-only endpoints (auth, task polling) remain fast under load thanks to async architecture.

## Monitoring

### Prometheus Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method/path/status |
| `http_request_duration_seconds` | Histogram | Request latency distribution |
| `llm_requests_total` | Counter | LLM API calls by provider/status |
| `llm_tokens_total` | Counter | Token consumption by provider |
| `llm_request_duration_seconds` | Histogram | LLM call latency |
| `llm_fallback_total` | Counter | Provider fallback events |
| `cache_operations_total` | Counter | Cache hits vs misses |
| `ratelimit_rejected_total` | Counter | Rate-limited requests |

### Grafana Dashboard Panels

1. **Request Rate** — `rate(http_requests_total[5m])`
2. **P95 Latency** — `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
3. **Token Burn Rate** — `rate(llm_tokens_total[5m]) * 60`
4. **Cache Hit Rate** — `rate(cache_operations_total{result="hit"}[5m]) / rate(cache_operations_total[5m])`
5. **Rate Limit Rejections** — `rate(ratelimit_rejected_total[5m]) * 60`
6. **LLM Fallback Rate** — `rate(llm_fallback_total[5m]) * 60`

## CI/CD

GitHub Actions pipeline runs on every push and PR to `main`:

1. **Go Build & Vet** — compile both API and Worker binaries, run static analysis
2. **Python Lint** — validate imports and syntax
3. **Docker Build** — verify both Dockerfiles build successfully

