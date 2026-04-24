# Observability

ChangeNow uses structured logs in Go, basic Python logging, request IDs, and Prometheus metrics from the Go API.

## Request IDs

The Go API request ID middleware:

- Reads `X-Request-ID` if supplied.
- Generates a UUID if absent.
- Stores it in Gin context.
- Echoes it in the response header.

The Go worker forwards the request ID to the Python AI service. The Python AI service middleware also echoes `X-Request-ID`.

## Go Logs

Logger setup lives in `services/api-go/internal/logger/logger.go`. The API uses Zap and Gin middleware for request logging.

Important log events:

- API startup and shutdown.
- Redis availability.
- AI service reachability.
- Migration application.
- Worker task start and completion.
- Worker AI failures.
- Cache write failures.
- Row scan warnings in handlers.

## Python Logs

The Python service configures standard logging in `services/ai-py/app/main.py` using `LOG_LEVEL`.

Important log events:

- Gateway provider registration.
- Provider request success/failure.
- Fallback success.
- Agent node progress.
- Request start metadata with request ID, method, and path.

## Prometheus Metrics

The Go API exposes `/metrics`.

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `http_requests_total` | Counter | `method`, `path`, `status` | HTTP request count. |
| `http_request_duration_seconds` | Histogram | `method`, `path` | HTTP request latency. |
| `llm_requests_total` | Counter | `provider`, `status` | LLM call count as recorded by worker. |
| `llm_tokens_total` | Counter | `provider` | LLM token usage as recorded by worker. |
| `llm_request_duration_seconds` | Histogram | `provider` | LLM call latency as recorded by worker. |
| `llm_fallback_total` | Counter | none | Defined but not currently incremented. |
| `cache_operations_total` | Counter | `result` | Plan cache hit/miss count. |
| `ratelimit_rejected_total` | Counter | none | Rate-limit rejections. |

## Prometheus Scrape Config

`deploy/prometheus.yml` scrapes:

```yaml
scrape_configs:
  - job_name: "api-go"
    static_configs:
      - targets: ["api:8080"]
    metrics_path: /metrics
```

## Useful Queries

Request rate:

```promql
rate(http_requests_total[5m])
```

p95 API latency:

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

Plan cache hit ratio:

```promql
sum(rate(cache_operations_total{result="hit"}[5m]))
/
sum(rate(cache_operations_total[5m]))
```

Rate-limit rejections per minute:

```promql
rate(ratelimit_rejected_total[5m]) * 60
```

LLM token burn per minute:

```promql
sum(rate(llm_tokens_total[5m])) * 60
```

## Recommended Alerts

- API process unavailable: Prometheus cannot scrape `/metrics`.
- High API p95 latency: p95 above target for more than 10 minutes.
- High 5xx rate: elevated `http_requests_total` with status `5xx`.
- LLM failure spike: `llm_requests_total{status="error"}` increases quickly.
- Stale pending tasks: database query for old `tasks.status='pending'`.
- Worker not processing: tasks remain pending while API continues accepting generation requests.
- Redis unavailable: API logs rate-limit/cache disabled, worker exits if Redis cache connection fails.

