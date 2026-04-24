# 0001: Split Go API And Python AI Service

## Status

Accepted.

## Context

The product needs conventional API behavior, durable data writes, auth, queueing, and AI orchestration. Go is already used for the API and worker. Python is already used for FastAPI, LangGraph, provider SDKs, and prompt management.

## Decision

Keep the Go API/worker and Python AI service as separate services connected by HTTP JSON.

## Consequences

- Go owns authentication, REST contracts, database writes, rate limiting, queueing, and metrics.
- Python owns prompt rendering, provider fallback, and agent workflow orchestration.
- The boundary is easy to inspect and test because request/response structs exist on both sides.
- Deployment must manage an internal service URL from Go to Python.
- Request IDs should be propagated across the boundary for debugging.

