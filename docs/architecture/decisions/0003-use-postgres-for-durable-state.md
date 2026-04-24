# 0003: Use PostgreSQL For Durable State

## Status

Accepted.

## Context

ChangeNow stores accounts, AI plan outputs, async task status, exercise libraries, and workout logs. These records need relational ownership, uniqueness constraints, and transactional updates.

## Decision

Use PostgreSQL as the system of record.

## Consequences

- User-owned rows can cascade on user deletion.
- Daily workout uniqueness is enforced by the database.
- Workout log and set writes can be transactionally grouped.
- Migrations must be applied consistently across local, CI, and deployed environments.
- JSON plan shape is not currently enforced because plans are stored as text.

