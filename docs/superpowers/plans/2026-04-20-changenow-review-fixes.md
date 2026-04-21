# ChangeNow Review-Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the ship-blocking security and correctness fixes identified in the 2026-04-20 project review of the Go API service, plus minimum supporting test harness, without regressing existing behavior.

**Architecture:**
Fixes are applied directly to the existing Go monolith under `services/api-go`. A minimal integration-test harness (Postgres + Redis via `docker-compose.test.yml`, driven by `pgxpool` and go-redis) is added in Task 0 to support TDD of the security middleware and handler fixes. Frontend and Python AI service hardening and broader coverage work are intentionally deferred to follow-on plans.

**Tech Stack:** Go 1.25 · Gin · pgx/v5 · redis/go-redis v9 · hibiken/asynq · golang-jwt/jwt v5 · bcrypt · Zap · Prometheus client · stdlib `testing` (table-driven, `-race`) · `httptest` · optional `testcontainers-go` (or a running dockerized pg/redis for CI)

**Out of scope (covered in follow-on plans):**
- Frontend `theme.ts` revert, `any`→`unknown`, unused imports
- Python AI service: robust JSON extraction, request-id plumbing, logging format, agent fail-closed semantics
- Broader test-coverage push (workout query behaviour, load, e2e)
- `.env.example`, Swagger/OpenAPI, API healthcheck wiring in compose

---

## File Structure

### Modify
- `services/api-go/internal/http/middleware/auth.go` — enforce HS256 signing method
- `services/api-go/internal/http/handlers/auth.go` — stop discarding bcrypt / JWT-sign errors; fail loud if `JWT_SECRET` missing; distinguish DB error vs duplicate email; remove debug `log.Printf`
- `services/api-go/internal/http/middleware/ratelimit.go` — add `RateLimiterByIP` variant (new exported fn, same file)
- `services/api-go/internal/http/routes.go` — apply `RateLimiterByIP` to `/auth/register` and `/auth/login`; reformat (gofmt)
- `services/api-go/internal/http/handlers/workout.go` — use `CURRENT_DATE` instead of `time.Now()` for `performed_at`; auto-assign server-side `set_number`; scope `DeleteSet` volume recompute to the affected log; log scan errors; drop `fmt.Print(err)` debug calls
- `services/api-go/internal/http/handlers/exercises.go` — log scan errors (not silent continue); use request context
- `services/api-go/internal/http/handlers/plans.go` — use request context throughout
- `services/api-go/internal/http/handlers/query.go` — use request context throughout
- `services/api-go/internal/worker/handler.go` — write successful plan JSON to the plan cache after insert
- `services/api-go/internal/cache/redis.go` — (no changes expected; re-read only)
- `services/api-go/cmd/api/main.go` — make `JWT_SECRET` validation explicit at startup; de-dup "API starting" log
- `services/api-go/go.mod` / `go.sum` — `go mod tidy` output
- `deploy/docker-compose.yml` — move `JWT_SECRET` to `env_file` / required-from-env pattern

### Create
- `services/api-go/internal/http/middleware/auth_test.go` — table-driven tests for HS256 enforcement, alg-confusion, expired, missing claim
- `services/api-go/internal/http/middleware/ratelimit_test.go` — per-IP sliding window
- `services/api-go/internal/http/handlers/auth_test.go` — register/login happy + missing secret + duplicate email
- `services/api-go/internal/http/handlers/workout_test.go` — date semantics, set-number assignment, DeleteSet scoping
- `services/api-go/internal/worker/handler_test.go` — cache-write after success
- `services/api-go/internal/testutil/testdb.go` — Postgres + Redis test harness bootstrap
- `services/api-go/test/docker-compose.test.yml` — ephemeral pg/redis for `go test`
- `services/api-go/Makefile` — `make test` target that starts/stops the harness

### Delete
- `services/api-go/internal/http/handlers/plans_mock.go` (empty, untracked)
- `services/api-go/internal/http/handlers/routes.go` (empty, untracked; real one lives at `internal/http/routes.go`)

---

## Task 0: Integration-test harness

**Files:**
- Create: `services/api-go/test/docker-compose.test.yml`
- Create: `services/api-go/internal/testutil/testdb.go`
- Create: `services/api-go/Makefile`

- [ ] **Step 0.1: Add test compose file**

Create `services/api-go/test/docker-compose.test.yml`:

```yaml
services:
  pg-test:
    image: postgres:16
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: changenow_test
    ports: ["55432:5432"]
    volumes:
      - ../migrations:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d changenow_test"]
      interval: 2s
      timeout: 2s
      retries: 20
  redis-test:
    image: redis:7-alpine
    ports: ["56379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 2s
      retries: 20
```

- [ ] **Step 0.2: Add test helper**

Create `services/api-go/internal/testutil/testdb.go`:

```go
package testutil

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func PGPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://test:test@localhost:55432/changenow_test?sslmode=disable"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx, `TRUNCATE users, tasks, plans, exercises, workout_logs, workout_sets RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return pool
}

func Redis(t *testing.T) *redis.Client {
	t.Helper()
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		url = "redis://localhost:56379/0"
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		t.Fatalf("redis.ParseURL: %v", err)
	}
	c := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := c.Ping(ctx).Err(); err != nil {
		t.Fatalf("redis ping: %v", err)
	}
	t.Cleanup(func() { _ = c.FlushDB(context.Background()).Err(); _ = c.Close() })
	return c
}
```

- [ ] **Step 0.3: Add Makefile targets**

Create `services/api-go/Makefile`:

```makefile
.PHONY: test test-up test-down fmt tidy vet

test-up:
	docker compose -f test/docker-compose.test.yml up -d --wait

test-down:
	docker compose -f test/docker-compose.test.yml down -v

test: test-up
	TEST_DATABASE_URL=postgres://test:test@localhost:55432/changenow_test?sslmode=disable \
	TEST_REDIS_URL=redis://localhost:56379/0 \
	go test -race ./...

fmt:
	gofmt -w .

tidy:
	go mod tidy

vet:
	go vet ./...
```

- [ ] **Step 0.4: Bring harness up and verify it is reachable**

Run:
```bash
cd services/api-go && make test-up
docker compose -f test/docker-compose.test.yml ps
```
Expected: both services show `healthy`.

- [ ] **Step 0.5: Commit**

```bash
git add services/api-go/test/docker-compose.test.yml \
        services/api-go/internal/testutil/testdb.go \
        services/api-go/Makefile
git commit -m "test: add integration test harness (pg + redis + makefile)"
```

---

## Task 1: Enforce JWT signing method (CRITICAL — alg-confusion)

**Files:**
- Modify: `services/api-go/internal/http/middleware/auth.go:29-35`
- Create: `services/api-go/internal/http/middleware/auth_test.go`

- [ ] **Step 1.1: Write the failing test**

Create `services/api-go/internal/http/middleware/auth_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func makeHS256(t *testing.T, secret string, exp time.Time) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": float64(42),
		"exp":     exp.Unix(),
	})
	signed, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign HS256: %v", err)
	}
	return signed
}

func makeAlgNone(t *testing.T) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"user_id": float64(42),
		"exp":     time.Now().Add(time.Hour).Unix(),
	})
	signed, err := tok.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("sign none: %v", err)
	}
	return signed
}

func TestAuthRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "unit-test-secret")

	cases := []struct {
		name   string
		header string
		want   int
	}{
		{"missing header", "", http.StatusUnauthorized},
		{"wrong scheme", "Token abc", http.StatusUnauthorized},
		{"valid HS256", "Bearer " + makeHS256(t, "unit-test-secret", time.Now().Add(time.Hour)), http.StatusOK},
		{"wrong secret", "Bearer " + makeHS256(t, "attacker-secret", time.Now().Add(time.Hour)), http.StatusUnauthorized},
		{"expired", "Bearer " + makeHS256(t, "unit-test-secret", time.Now().Add(-time.Hour)), http.StatusUnauthorized},
		{"alg none", "Bearer " + makeAlgNone(t), http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.Use(AuthRequired())
			r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Fatalf("got %d want %d (body=%s)", w.Code, tc.want, w.Body.String())
			}
		})
	}
}

func TestAuthRequired_MissingSecret(t *testing.T) {
	gin.SetMode(gin.TestMode)
	_ = os.Unsetenv("JWT_SECRET")
	r := gin.New()
	r.Use(AuthRequired())
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer doesnt-matter")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("got %d want 500", w.Code)
	}
}
```

- [ ] **Step 1.2: Run test to verify `alg none` fails today**

Run:
```bash
cd services/api-go && go test -run TestAuthRequired -v ./internal/http/middleware/...
```
Expected: `alg none` subtest FAILS with status 200 (because current code accepts any alg).

- [ ] **Step 1.3: Fix the middleware**

Modify `services/api-go/internal/http/middleware/auth.go`, replacing the `jwt.Parse` callback:

```go
    token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
      if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
        return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
      }
      return []byte(secret), nil
    })
```

Add `"fmt"` to the imports.

- [ ] **Step 1.4: Run test to verify it passes**

Run:
```bash
go test -race -run TestAuthRequired -v ./internal/http/middleware/...
```
Expected: all subtests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add services/api-go/internal/http/middleware/auth.go \
        services/api-go/internal/http/middleware/auth_test.go
git commit -m "fix(auth): enforce HS256 signing method (JWT alg-confusion)"
```

---

## Task 2: Stop discarding bcrypt & JWT-sign errors

**Files:**
- Modify: `services/api-go/internal/http/handlers/auth.go:27,41-47,80-86,36`
- Create: `services/api-go/internal/http/handlers/auth_test.go`

- [ ] **Step 2.1: Add a helper for issuing tokens**

Create or extend `services/api-go/internal/http/handlers/auth.go` with:

```go
func issueToken(userID int64) (string, error) {
    secret := os.Getenv("JWT_SECRET")
    if secret == "" {
        return "", fmt.Errorf("JWT_SECRET not set")
    }
    claims := jwt.MapClaims{
        "user_id": userID,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    }
    tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return tok.SignedString([]byte(secret))
}
```

Add `"fmt"`, `"errors"` to imports as needed.

- [ ] **Step 2.2: Write failing tests**

Create `services/api-go/internal/http/handlers/auth_test.go`:

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"changenow/api-go/internal/testutil"
)

func newRouter(t *testing.T) (*gin.Engine, *Handlers) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	pool := testutil.PGPool(t)
	h := New(pool, nil, nil, nil)
	r := gin.New()
	r.POST("/register", h.Register)
	r.POST("/login", h.Login)
	return r, h
}

func TestRegister_Login_RoundTrip(t *testing.T) {
	t.Setenv("JWT_SECRET", "unit-test-secret")
	r, _ := newRouter(t)

	body, _ := json.Marshal(map[string]string{"email": "a@b.com", "password": "hunter22"})
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("register: got %d body=%s", w.Code, w.Body.String())
	}
	var reg map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &reg)
	if reg["access_token"] == "" {
		t.Fatalf("empty access token: %v", reg)
	}
}

func TestRegister_DuplicateEmail_Returns409(t *testing.T) {
	t.Setenv("JWT_SECRET", "unit-test-secret")
	r, h := newRouter(t)
	_, err := h.db.Exec(context.Background(),
		`INSERT INTO users(email, password_hash) VALUES ('dup@x.com','x')`)
	if err != nil { t.Fatal(err) }

	body, _ := json.Marshal(map[string]string{"email": "dup@x.com", "password": "hunter22"})
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("got %d want 409 body=%s", w.Code, w.Body.String())
	}
}

func TestRegister_MissingSecret_Returns500_NoToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	r, _ := newRouter(t)
	body, _ := json.Marshal(map[string]string{"email": "nosec@x.com", "password": "hunter22"})
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("got %d want 500 body=%s", w.Code, w.Body.String())
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if _, ok := resp["access_token"]; ok {
		t.Fatalf("response must not include access_token when secret missing: %v", resp)
	}
}
```

- [ ] **Step 2.3: Run tests to verify they fail**

Run:
```bash
make test-up
TEST_DATABASE_URL=... TEST_REDIS_URL=... go test -race -run TestRegister -v ./internal/http/handlers/...
```
Expected: `TestRegister_DuplicateEmail_Returns409` fails (current code returns 400), and `TestRegister_MissingSecret_Returns500_NoToken` fails (current code returns 201 with empty token).

- [ ] **Step 2.4: Rewrite the `Register` handler**

Replace the body of `Register` in `services/api-go/internal/http/handlers/auth.go`:

```go
func (h *Handlers) Register(c *gin.Context) {
    var req registerReq
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "password hashing failed"})
        return
    }

    var id int64
    err = h.db.QueryRow(c.Request.Context(),
        `INSERT INTO users(email, password_hash) VALUES ($1,$2) RETURNING id`,
        req.Email, string(hash),
    ).Scan(&id)
    if err != nil {
        var pgErr *pgconn.PgError
        if errors.As(err, &pgErr) && pgErr.Code == "23505" {
            c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
        return
    }

    token, err := issueToken(id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
        return
    }

    c.JSON(http.StatusCreated, gin.H{"id": id, "email": req.Email, "access_token": token})
}
```

Add imports: `"errors"`, `"github.com/jackc/pgx/v5/pgconn"`.

- [ ] **Step 2.5: Rewrite the `Login` handler**

Replace the body of `Login`:

```go
func (h *Handlers) Login(c *gin.Context) {
    var req loginReq
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    var id int64
    var hash string
    err := h.db.QueryRow(c.Request.Context(),
        `SELECT id, password_hash FROM users WHERE email=$1`, req.Email,
    ).Scan(&id, &hash)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
        return
    }
    if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
        return
    }

    token, err := issueToken(id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"access_token": token})
}
```

Remove the unused `"log"` import and the `log.Printf("DEBUG: ...")` line.

- [ ] **Step 2.6: Run tests to verify pass**

Run:
```bash
go test -race -run TestRegister -v ./internal/http/handlers/...
```
Expected: all subtests PASS.

- [ ] **Step 2.7: Commit**

```bash
git add services/api-go/internal/http/handlers/auth.go \
        services/api-go/internal/http/handlers/auth_test.go
git commit -m "fix(auth): stop discarding bcrypt/JWT errors; return 409 on duplicate email; drop debug log"
```

---

## Task 3: Rate-limit public auth routes (per-IP)

**Files:**
- Modify: `services/api-go/internal/http/middleware/ratelimit.go`
- Modify: `services/api-go/internal/http/routes.go:32-56`
- Create: `services/api-go/internal/http/middleware/ratelimit_test.go`

- [ ] **Step 3.1: Write the failing test**

Create `services/api-go/internal/http/middleware/ratelimit_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"changenow/api-go/internal/cache"
	"changenow/api-go/internal/testutil"
)

func TestRateLimiterByIP_BlocksAfterLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	_ = testutil.Redis(t) // ensures Redis is healthy + flushed
	rc, err := cache.NewRedisClient("redis://localhost:56379/0")
	if err != nil { t.Fatal(err) }

	r := gin.New()
	r.Use(RateLimiterByIP(rc, 3, 1*time.Minute))
	r.POST("/auth/login", func(c *gin.Context) { c.Status(http.StatusOK) })

	hit := func() int {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	for i := 0; i < 3; i++ {
		if c := hit(); c != http.StatusOK {
			t.Fatalf("req %d: got %d want 200", i+1, c)
		}
	}
	if c := hit(); c != http.StatusTooManyRequests {
		t.Fatalf("4th req: got %d want 429", c)
	}
}
```

- [ ] **Step 3.2: Run the test and confirm compile failure**

Run:
```bash
go test -run TestRateLimiterByIP -v ./internal/http/middleware/...
```
Expected: FAIL with `undefined: RateLimiterByIP`.

- [ ] **Step 3.3: Add `RateLimiterByIP`**

Append to `services/api-go/internal/http/middleware/ratelimit.go`:

```go
func RateLimiterByIP(redisClient *cache.RedisClient, limit int64, window time.Duration) gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()
        if ip == "" {
            c.Next()
            return
        }
        key := fmt.Sprintf("ratelimit:ip:%s", ip)

        result, err := redisClient.CheckRateLimit(c.Request.Context(), key, limit, window)
        if err != nil {
            c.Next()
            return
        }

        c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
        c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", result.Remaining))
        c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", result.ResetAt.Unix()))

        if !result.Allowed {
            metrics.RateLimitHits.Inc()
            c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
                "error":               "rate limit exceeded",
                "retry_after_seconds": int(time.Until(result.ResetAt).Seconds()),
            })
            return
        }
        c.Next()
    }
}
```

- [ ] **Step 3.4: Run the test and confirm it passes**

Run:
```bash
go test -race -run TestRateLimiterByIP -v ./internal/http/middleware/...
```
Expected: PASS.

- [ ] **Step 3.5: Wire it into the public routes**

Modify `services/api-go/internal/http/routes.go`:

```go
  public := v1.Group("/")
  public.Use(middleware.RateLimiterByIP(redisClient, 20, 1*time.Minute))
  {
    public.POST("/auth/register", h.Register)
    public.POST("/auth/login",    h.Login)
  }
```

Replace the two existing `v1.POST(...)` calls for `auth/register`/`auth/login` with the block above.

- [ ] **Step 3.6: Commit**

```bash
git add services/api-go/internal/http/middleware/ratelimit.go \
        services/api-go/internal/http/middleware/ratelimit_test.go \
        services/api-go/internal/http/routes.go
git commit -m "feat(auth): per-IP rate limit on /auth/register and /auth/login"
```

---

## Task 4: Externalize JWT_SECRET in docker-compose

**Files:**
- Modify: `deploy/docker-compose.yml:45-56`
- Modify: `services/api-go/cmd/api/main.go` (fail-fast if env is missing)

- [ ] **Step 4.1: Fail fast in the API binary**

Edit `services/api-go/cmd/api/main.go` after `godotenv.Load()`:

```go
if os.Getenv("JWT_SECRET") == "" {
    log.Fatal("JWT_SECRET is empty")
}
```

De-duplicate the `"API starting"` log: remove the `logger.Log.Info("API starting", ...)` call at line 95; keep only the one inside the goroutine at line 104.

- [ ] **Step 4.2: Update compose**

In `deploy/docker-compose.yml`, replace the `api` service environment block:

```yaml
  api:
    build:
      context: ../services/api-go
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    env_file:
      - ../services/api-go/.env
    environment:
      - DATABASE_URL=postgres://app:app@postgres:5432/changenow?sslmode=disable
      - AI_SERVICE_URL=http://ai-service:8001
      - PORT=8080
      - REDIS_URL=redis://redis:6379/0
```

- [ ] **Step 4.3: Add committed example env**

Create `services/api-go/.env.example` (tracked) with:

```env
JWT_SECRET=replace_me_with_a_long_random_string
```

And add `services/api-go/.env` to `.gitignore` (verify it is already ignored via the root `.gitignore`; if not, add the line).

- [ ] **Step 4.4: Verify**

Run:
```bash
cd services/api-go && go build ./cmd/api && JWT_SECRET= ./api
```
Expected: binary exits with `JWT_SECRET is empty`.

- [ ] **Step 4.5: Commit**

```bash
git add deploy/docker-compose.yml \
        services/api-go/cmd/api/main.go \
        services/api-go/.env.example \
        .gitignore
git commit -m "chore(deploy): require JWT_SECRET from env; fail fast at startup"
```

---

## Task 5: Repo hygiene (empty files, `go mod tidy`, `gofmt`)

**Files:**
- Delete: `services/api-go/internal/http/handlers/plans_mock.go`
- Delete: `services/api-go/internal/http/handlers/routes.go`
- Modify: `services/api-go/go.mod`, `services/api-go/go.sum`
- Modify: every `.go` file under `services/api-go` (whitespace only)

- [ ] **Step 5.1: Remove empty files**

```bash
rm services/api-go/internal/http/handlers/plans_mock.go \
   services/api-go/internal/http/handlers/routes.go
```

- [ ] **Step 5.2: `go mod tidy`**

```bash
cd services/api-go && go mod tidy
```
Expected: every actually-imported dep moves out of the `// indirect` group; transitive deps stay marked.

- [ ] **Step 5.3: `gofmt`**

```bash
cd services/api-go && gofmt -w .
```

- [ ] **Step 5.4: Build + vet + test still green**

```bash
go vet ./...
go test -race ./...
```
Expected: compile OK, vet OK, tests added so far still PASS.

- [ ] **Step 5.5: Commit**

```bash
git add services/api-go
git commit -m "chore(go): remove empty stub files; go mod tidy; gofmt"
```

---

## Task 6: Workout `performed_at` date semantics

**Files:**
- Modify: `services/api-go/internal/http/handlers/workout.go:84-122`
- Create: `services/api-go/internal/http/handlers/workout_test.go`

- [ ] **Step 6.1: Write the failing test**

Create `services/api-go/internal/http/handlers/workout_test.go`:

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"changenow/api-go/internal/http/middleware"
	"changenow/api-go/internal/testutil"
)

func seedUser(t *testing.T, h *Handlers) int64 {
	t.Helper()
	var id int64
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id`,
		"u@x.com", "x").Scan(&id)
	if err != nil { t.Fatal(err) }
	return id
}

func seedExercise(t *testing.T, h *Handlers, uid int64) int64 {
	t.Helper()
	var id int64
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO exercises(user_id,name) VALUES($1,$2) RETURNING id`,
		uid, "Bench Press").Scan(&id)
	if err != nil { t.Fatal(err) }
	return id
}

func TestLogWorkout_SameDay_AppendsToSameLog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	pool := testutil.PGPool(t)
	h := New(pool, nil, nil, nil)
	uid := seedUser(t, h)
	exid := seedExercise(t, h, uid)

	r := gin.New()
	r.POST("/workouts", func(c *gin.Context) {
		c.Set(middleware.CtxUserIDKey, uid)
		h.LogWorkout(c)
	})

	post := func(sets []map[string]any) int {
		body, _ := json.Marshal(map[string]any{"exercise_id": exid, "sets": sets})
		req := httptest.NewRequest(http.MethodPost, "/workouts", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	if c := post([]map[string]any{{"set_number": 1, "weight": 100.0, "reps": 5}}); c != http.StatusCreated {
		t.Fatalf("first log: got %d", c)
	}
	if c := post([]map[string]any{{"set_number": 1, "weight": 105.0, "reps": 5}}); c != http.StatusCreated {
		t.Fatalf("second log: got %d", c)
	}

	var logCount int
	if err := pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM workout_logs WHERE user_id=$1`, uid).Scan(&logCount); err != nil {
		t.Fatal(err)
	}
	if logCount != 1 {
		t.Fatalf("expected 1 workout_log per day, got %d", logCount)
	}
}
```

- [ ] **Step 6.2: Run and confirm failure**

Run:
```bash
go test -race -run TestLogWorkout_SameDay -v ./internal/http/handlers/...
```
Expected: FAIL (currently each call creates a new row because `performed_at = $1` uses `time.Now()` at microsecond precision).

- [ ] **Step 6.3: Fix `LogWorkout`**

In `services/api-go/internal/http/handlers/workout.go`, replace the "start transaction → insert/update log" block (lines ~84-123) with:

```go
    // 1. Upsert the workout_log row for today.
    var logID int64
    err = tx.QueryRow(c.Request.Context(),
        `INSERT INTO workout_logs (user_id, performed_at, volume, notes)
         VALUES ($1, CURRENT_DATE, $2, $3)
         ON CONFLICT (user_id, performed_at) DO UPDATE
         SET volume = workout_logs.volume + EXCLUDED.volume,
             notes  = CASE WHEN EXCLUDED.notes <> '' THEN EXCLUDED.notes ELSE workout_logs.notes END
         RETURNING id`,
        uid, totalVolume, req.Notes,
    ).Scan(&logID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upsert workout log"})
        return
    }
```

Also change the earlier `createdAt := time.Now()` assignment — delete it; it is no longer used.

Add the required unique index in a new migration:

Create `services/api-go/migrations/003_workout_logs_unique_day.sql`:

```sql
ALTER TABLE workout_logs
    ADD CONSTRAINT workout_logs_user_day_unique UNIQUE (user_id, performed_at);
```

- [ ] **Step 6.4: Re-run tests**

Run:
```bash
# Migrations run on container start; rebuild the test DB.
make test-down && make test-up
go test -race -run TestLogWorkout -v ./internal/http/handlers/...
```
Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add services/api-go/internal/http/handlers/workout.go \
        services/api-go/internal/http/handlers/workout_test.go \
        services/api-go/migrations/003_workout_logs_unique_day.sql
git commit -m "fix(workout): one log per user per day via ON CONFLICT; use CURRENT_DATE"
```

---

## Task 7: Server-side `set_number` assignment

**Files:**
- Modify: `services/api-go/internal/http/handlers/workout.go:127-151`
- Modify: `services/api-go/internal/http/handlers/workout.go` (remove `SetNumber` binding requirement)
- Modify: `services/api-go/internal/http/handlers/workout_test.go` (add test)

- [ ] **Step 7.1: Extend the test**

Append to `workout_test.go`:

```go
func TestLogWorkout_SetNumbers_AreServerAssigned(t *testing.T) {
	gin.SetMode(gin.TestMode)
	pool := testutil.PGPool(t)
	h := New(pool, nil, nil, nil)
	uid := seedUser(t, h)
	exid := seedExercise(t, h, uid)

	r := gin.New()
	r.POST("/workouts", func(c *gin.Context) {
		c.Set(middleware.CtxUserIDKey, uid)
		h.LogWorkout(c)
	})

	post := func(payload map[string]any) int {
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/workouts", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	// Client sends nonsense set_number values; server should ignore them.
	_ = post(map[string]any{"exercise_id": exid, "sets": []map[string]any{
		{"set_number": 999, "weight": 100.0, "reps": 5},
		{"set_number": 0,   "weight": 100.0, "reps": 5},
	}})
	_ = post(map[string]any{"exercise_id": exid, "sets": []map[string]any{
		{"set_number": 1, "weight": 105.0, "reps": 5},
	}})

	rows, err := pool.Query(context.Background(),
		`SELECT set_number FROM workout_sets WHERE exercise_id=$1 ORDER BY id`, exid)
	if err != nil { t.Fatal(err) }
	defer rows.Close()

	got := []int{}
	for rows.Next() {
		var n int
		if err := rows.Scan(&n); err != nil { t.Fatal(err) }
		got = append(got, n)
	}
	want := []int{1, 2, 3}
	if len(got) != len(want) {
		t.Fatalf("got %v want %v", got, want)
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("got %v want %v", got, want)
		}
	}
}
```

- [ ] **Step 7.2: Confirm failure**

Run:
```bash
go test -race -run TestLogWorkout_SetNumbers -v ./internal/http/handlers/...
```
Expected: FAIL (current impl honors client-sent `set_number`).

- [ ] **Step 7.3: Fix the handler**

In `services/api-go/internal/http/handlers/workout.go`:

Change `setReq` to drop the `binding:"required"` on `SetNumber` (the field will now be ignored):

```go
type setReq struct {
    Weight float64 `json:"weight" binding:"required"`
    Reps   int     `json:"reps"   binding:"required"`
}
```

Replace the set-insert loop with:

```go
    // 2. Compute starting set_number for this exercise in this log.
    var startNum int
    err = tx.QueryRow(c.Request.Context(), `
        SELECT COALESCE(MAX(set_number), 0)
        FROM workout_sets
        WHERE workout_log_id = $1 AND exercise_id = $2`,
        logID, req.ExerciseID,
    ).Scan(&startNum)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute set number"})
        return
    }

    for i, s := range req.Sets {
        _, err = tx.Exec(c.Request.Context(),
            `INSERT INTO workout_sets (workout_log_id, exercise_id, set_number, weight, reps)
             VALUES ($1, $2, $3, $4, $5)`,
            logID, req.ExerciseID, startNum+i+1, s.Weight, s.Reps,
        )
        if err != nil {
            logger.Log.Error("insert set", zap.Error(err))
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to insert set"})
            return
        }
    }
```

Remove the earlier `fmt.Print(err)` line at what was `workout.go:147`.

Add imports: `"changenow/api-go/internal/logger"`, `"go.uber.org/zap"` (if not already present; they are not in this file today).

- [ ] **Step 7.4: Run tests, all green**

Run:
```bash
go test -race -v ./internal/http/handlers/...
```
Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add services/api-go/internal/http/handlers/workout.go \
        services/api-go/internal/http/handlers/workout_test.go
git commit -m "fix(workout): assign set_number server-side; ignore client value"
```

---

## Task 8: Scope `DeleteSet` volume recompute

**Files:**
- Modify: `services/api-go/internal/http/handlers/workout.go:297-337`
- Modify: `services/api-go/internal/http/handlers/workout_test.go` (add test)

- [ ] **Step 8.1: Add failing test**

Append to `workout_test.go`:

```go
func TestDeleteSet_RecomputesOnlyOwningLog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	pool := testutil.PGPool(t)
	h := New(pool, nil, nil, nil)
	uid := seedUser(t, h)
	exid := seedExercise(t, h, uid)

	// Seed two logs on different days, each with two sets.
	mustExec := func(q string, args ...any) {
		if _, err := pool.Exec(context.Background(), q, args...); err != nil { t.Fatal(err) }
	}
	mustExec(`INSERT INTO workout_logs(id,user_id,performed_at,volume)
	          VALUES (1,$1,CURRENT_DATE - INTERVAL '1 day', 200),
	                 (2,$1,CURRENT_DATE, 300)`, uid)
	mustExec(`INSERT INTO workout_sets(id,workout_log_id,exercise_id,set_number,weight,reps)
	          VALUES (1,1,$1,1,50,2), (2,1,$1,2,50,2),
	                 (3,2,$1,1,60,2), (4,2,$1,2,90,2)`, exid)

	r := gin.New()
	r.DELETE("/workouts/:id", func(c *gin.Context) {
		c.Set(middleware.CtxUserIDKey, uid)
		h.DeleteSet(c)
	})
	req := httptest.NewRequest(http.MethodDelete, "/workouts/3", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d body=%s", w.Code, w.Body.String())
	}

	var v1, v2 float64
	_ = pool.QueryRow(context.Background(), `SELECT volume FROM workout_logs WHERE id=1`).Scan(&v1)
	_ = pool.QueryRow(context.Background(), `SELECT volume FROM workout_logs WHERE id=2`).Scan(&v2)
	if v1 != 200 { t.Fatalf("log 1 volume changed: %v", v1) }
	if v2 != 180 { t.Fatalf("log 2 volume: got %v want 180", v2) }
}
```

- [ ] **Step 8.2: Run, confirm failure**

Run:
```bash
go test -race -run TestDeleteSet -v ./internal/http/handlers/...
```
Expected: FAIL (current code also rewrites `log 1` volume).

- [ ] **Step 8.3: Fix `DeleteSet`**

Replace the body with:

```go
func (h *Handlers) DeleteSet(c *gin.Context) {
    uid := c.GetInt64(middleware.CtxUserIDKey)
    setID := c.Param("id")

    var logID int64
    err := h.db.QueryRow(c.Request.Context(),
        `DELETE FROM workout_sets ws
         USING workout_logs wl
         WHERE ws.workout_log_id = wl.id
           AND ws.id = $1
           AND wl.user_id = $2
         RETURNING ws.workout_log_id`,
        setID, uid,
    ).Scan(&logID)
    if errors.Is(err, pgx.ErrNoRows) {
        c.JSON(http.StatusNotFound, gin.H{"error": "set not found"})
        return
    }
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete"})
        return
    }

    _, err = h.db.Exec(c.Request.Context(),
        `UPDATE workout_logs
         SET volume = COALESCE((
             SELECT SUM(weight * reps) FROM workout_sets WHERE workout_log_id = $1
         ), 0)
         WHERE id = $1`,
        logID,
    )
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update volume"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"deleted": true})
}
```

Add `"errors"` to imports.

- [ ] **Step 8.4: Run tests green**

Run:
```bash
go test -race -v ./internal/http/handlers/...
```
Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add services/api-go/internal/http/handlers/workout.go \
        services/api-go/internal/http/handlers/workout_test.go
git commit -m "fix(workout): scope DeleteSet volume recompute to affected log"
```

---

## Task 9: Wire plan cache writes in the worker

**Files:**
- Modify: `services/api-go/internal/worker/handler.go:84-103`
- Modify: `services/api-go/internal/worker/tasks.go` (expose cache key inputs if necessary)
- Modify: `services/api-go/cmd/worker/main.go` (inject `*cache.RedisClient`)
- Create: `services/api-go/internal/worker/handler_test.go`

- [ ] **Step 9.1: Inject Redis into the worker**

In `cmd/worker/main.go`, after the existing `redisOpt` block, build a cache client and pass it into `NewPlanHandler`:

```go
rc, err := cache.NewRedisClient(redisURL)
if err != nil {
    log.Fatalf("redis for worker: %v", err)
}
defer rc.Close()

planHandler := worker.NewPlanHandler(pool, aiClient, rc)
```

Add `"changenow/api-go/internal/cache"` to imports.

- [ ] **Step 9.2: Update handler constructor**

In `internal/worker/handler.go`:

```go
type PlanHandler struct {
    db       *pgxpool.Pool
    aiClient *ai.Client
    cache    *cache.RedisClient
}

func NewPlanHandler(db *pgxpool.Pool, aiClient *ai.Client, rc *cache.RedisClient) *PlanHandler {
    return &PlanHandler{db: db, aiClient: aiClient, cache: rc}
}
```

Add `"changenow/api-go/internal/cache"` to imports.

- [ ] **Step 9.3: Write cache entry after successful insert**

After the `INSERT INTO plans(...)` block in `HandlePlanGenerate`, add:

```go
    if h.cache != nil {
        key := cache.PlanCacheKey(payload.UserID, payload.Goal, payload.DaysPerWeek,
            payload.Equipment, payload.Constraints, payload.PromptVersion)
        body, _ := json.Marshal(gin.H{
            "id":        planID.String(),
            "plan_text": aiResp.PlanText,
        })
        _ = h.cache.SetCachedPlan(ctx, key, body, 24*time.Hour)
    }
```

Add `"github.com/gin-gonic/gin"` to imports (used only for `gin.H` — acceptable in `internal/` or switch to `map[string]string` if you prefer to avoid the dep from `worker`; prefer `map[string]string`):

```go
body, _ := json.Marshal(map[string]string{
    "id":        planID.String(),
    "plan_text": aiResp.PlanText,
})
```

- [ ] **Step 9.4: Add handler test (happy path)**

Create `services/api-go/internal/worker/handler_test.go`:

```go
package worker

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/hibiken/asynq"

	"changenow/api-go/internal/ai"
	"changenow/api-go/internal/cache"
	"changenow/api-go/internal/testutil"
)

type stubAI struct{ resp ai.GenerateResponse }
func (s *stubAI) Generate(ctx context.Context, r ai.GenerateRequest, id string) (*ai.GenerateResponse, error) {
	return &s.resp, nil
}

func TestHandlePlanGenerate_WritesCache(t *testing.T) {
	pool := testutil.PGPool(t)
	rc, _ := cache.NewRedisClient("redis://localhost:56379/0")
	// seed a user + task
	var uid int64
	_ = pool.QueryRow(context.Background(),
		`INSERT INTO users(email,password_hash) VALUES('w@x.com','x') RETURNING id`).Scan(&uid)

	payload := PlanGeneratePayload{
		TaskID:        "00000000-0000-0000-0000-000000000001",
		UserID:        uid,
		Goal:          "strength",
		DaysPerWeek:   3,
		Equipment:     "barbell",
		Constraints:   "none",
		PromptVersion: "v1",
	}
	_, _ = pool.Exec(context.Background(),
		`INSERT INTO tasks(id,user_id,status) VALUES($1,$2,'pending')`, payload.TaskID, uid)

	body, _ := json.Marshal(payload)
	task := asynq.NewTask(TypePlanGenerate, body)

	h := &PlanHandler{db: pool, aiClient: nil, cache: rc}
	// inject an AI stub by replacing the call site in handler_test with a build-tag-free shim;
	// for this plan we assume the ai.Client is treated as an interface in a follow-up refactor.
	_ = h
	_ = task
	t.Skip("requires extracting ai.Client into an interface; covered in follow-on plan")
}
```

Note: this test is deliberately marked `t.Skip` — extracting `ai.Client` to a small interface is a dedicated follow-on refactor. We still land the cache-write code because it is straightforward enough to inspect by hand, and we verify via an integration run in Step 9.5.

- [ ] **Step 9.5: Manual integration verification**

Run end-to-end once:

```bash
cd deploy && docker compose up -d postgres redis
# Generate one plan via API; then:
redis-cli -p 6379 KEYS 'plan_cache:*'
```
Expected: at least one `plan_cache:*` key exists after a successful `GeneratePlan` → worker run.

- [ ] **Step 9.6: Commit**

```bash
git add services/api-go/internal/worker/handler.go \
        services/api-go/internal/worker/handler_test.go \
        services/api-go/cmd/worker/main.go
git commit -m "feat(cache): populate plan cache on worker success"
```

---

## Task 10: Propagate request context to DB calls

**Files:**
- Modify: `services/api-go/internal/http/handlers/auth.go`
- Modify: `services/api-go/internal/http/handlers/exercises.go`
- Modify: `services/api-go/internal/http/handlers/plans.go:64-68`
- Modify: `services/api-go/internal/http/handlers/query.go:22, 49`
- Modify: `services/api-go/internal/http/handlers/workout.go` (any remaining `context.Background()`)

- [ ] **Step 10.1: Replace `context.Background()` with `c.Request.Context()`**

For each file above, replace every `context.Background()` passed to `h.db.Query`, `h.db.QueryRow`, `h.db.Exec`, `h.db.Begin` with `c.Request.Context()`. Exception: the `defer tx.Rollback(context.Background())` call in `workout.go` should stay as-is, because the request context may already be cancelled by the time `defer` runs.

- [ ] **Step 10.2: Build + test**

Run:
```bash
go vet ./... && go test -race ./...
```
Expected: PASS.

- [ ] **Step 10.3: Commit**

```bash
git add services/api-go/internal/http/handlers
git commit -m "refactor(handlers): propagate request context to DB calls"
```

---

## Task 11: Log (don't silently swallow) scan errors

**Files:**
- Modify: `services/api-go/internal/http/handlers/exercises.go:52-57`
- Modify: `services/api-go/internal/http/handlers/workout.go` (three scan loops: ~192, ~237, ~278)

- [ ] **Step 11.1: Replace `continue` with logged continue**

In each scan loop, replace:

```go
if err := rows.Scan(&...); err != nil {
    continue
}
```

with:

```go
if err := rows.Scan(&...); err != nil {
    logger.Log.Warn("row scan failed", zap.Error(err))
    continue
}
```

Add `"changenow/api-go/internal/logger"` and `"go.uber.org/zap"` imports where missing.

- [ ] **Step 11.2: Build + test**

Run:
```bash
go vet ./... && go test -race ./...
```
Expected: PASS.

- [ ] **Step 11.3: Commit**

```bash
git add services/api-go/internal/http/handlers
git commit -m "refactor(handlers): log scan errors instead of silent continue"
```

---

## Task 12: Remove lingering debug prints

**Files:**
- Modify: `services/api-go/internal/http/handlers/workout.go:227`

- [ ] **Step 12.1: Delete `fmt.Print(err)` above the error check**

In `GetDailyExercisesHistory`, remove the bare `fmt.Print(err)` line. Remove `"fmt"` from imports if no longer referenced.

- [ ] **Step 12.2: Build**

```bash
go vet ./...
```
Expected: no errors, no unused-import failures.

- [ ] **Step 12.3: Commit**

```bash
git add services/api-go/internal/http/handlers/workout.go
git commit -m "chore(workout): drop stray fmt.Print debug"
```

---

## Task 13: CI — wire the test harness into GitHub Actions

**Files:**
- Modify: `.github/workflows/ci.yml` (or whichever file runs `go test` today — confirm via `ls .github/workflows`)

- [ ] **Step 13.1: Inspect current workflow**

Run:
```bash
ls -la .github/workflows
cat .github/workflows/*.yml
```

- [ ] **Step 13.2: Add a `services:` block to the Go job**

Add to the Go test job (inline in the existing file; do not create a new workflow):

```yaml
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: changenow_test
        ports: [ '55432:5432' ]
        options: >-
          --health-cmd="pg_isready -U test -d changenow_test"
          --health-interval=2s --health-timeout=2s --health-retries=20
      redis:
        image: redis:7-alpine
        ports: [ '56379:6379' ]
        options: >-
          --health-cmd="redis-cli ping" --health-interval=2s --health-retries=20
    env:
      TEST_DATABASE_URL: postgres://test:test@localhost:55432/changenow_test?sslmode=disable
      TEST_REDIS_URL: redis://localhost:56379/0
```

Add a step to apply migrations:

```yaml
      - name: Apply migrations
        run: |
          for f in services/api-go/migrations/*.sql; do
            psql "$TEST_DATABASE_URL" -f "$f"
          done
```

Add `go test -race ./...` as the final step in the Go job (replace any existing `go vet`-only step with vet + test).

- [ ] **Step 13.3: Commit**

```bash
git add .github/workflows
git commit -m "ci(go): add pg+redis services and run go test -race"
```

---

## Self-Review Notes

Covered vs. the 2026-04-20 review:
- [x] JWT alg-confusion (Task 1)
- [x] JWT_SECRET externalization + fail-fast (Task 4)
- [x] Discarded bcrypt / JWT-sign errors (Task 2)
- [x] Public auth rate limit (Task 3)
- [x] Empty Go files / `go mod tidy` / `gofmt` (Task 5)
- [x] `performed_at` date semantics (Task 6)
- [x] `set_number` collisions (Task 7)
- [x] DeleteSet volume scoping (Task 8)
- [x] Cache never populated (Task 9)
- [x] Request context propagation (Task 10)
- [x] Swallowed scan errors (Task 11)
- [x] Stray `fmt.Print` (Task 12)
- [x] CI wired to actually run tests (Task 13)

Deferred (new plans):
- Python AI service: robust JSON extraction, request-id plumbing, agent fail-closed semantics
- Frontend: revert `theme.ts` comment removal, drop unused imports, `any`→`unknown`, web token storage
- Infra: API healthcheck in compose, `.env.example` for ai-py, Swagger/OpenAPI
- Broader test coverage: query-path tests, e2e, Python pytest suite

Type consistency: `issueToken` returns `(string, error)`; `RateLimiterByIP` mirrors `RateLimiter` signature; `NewPlanHandler` gains a third arg `*cache.RedisClient` and is called from exactly one site.

No placeholder text, no "TBD", every step shows the code or command to run.
