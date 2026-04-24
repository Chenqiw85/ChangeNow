# 0004: Use Redis For Cache, Queue, And Rate Limits

## Status

Accepted.

## Context

The backend needs short-lived plan cache entries, a queue backend for Asynq, and sliding-window rate limits.

## Decision

Use Redis for:

- Plan cache entries with 24 hour TTL.
- Asynq queue storage.
- Sliding-window rate-limit keys.

## Consequences

- Redis becomes required for background plan generation.
- API rate limiting and plan cache can fail open when Redis is absent.
- Asynq enqueue and worker processing still depend on Redis connectivity.
- Redis key design must avoid collisions; plan cache includes user input and `use_agent`.

