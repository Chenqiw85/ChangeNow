package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"changenow/api-go/internal/cache"
	"changenow/api-go/internal/testutil"
)

func newRateLimitRedis(t *testing.T) *cache.RedisClient {
	t.Helper()
	_ = testutil.Redis(t)
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		url = "redis://localhost:56379/0"
	}
	rc, err := cache.NewRedisClient(url)
	if err != nil {
		t.Fatalf("cache.NewRedisClient: %v", err)
	}
	t.Cleanup(func() { _ = rc.Close() })
	return rc
}

func TestRateLimiterByIP_BlocksAfterLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rc := newRateLimitRedis(t)

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

func TestRateLimiterByIP_IsolatesDifferentIPs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rc := newRateLimitRedis(t)

	r := gin.New()
	r.Use(RateLimiterByIP(rc, 1, 1*time.Minute))
	r.POST("/auth/login", func(c *gin.Context) { c.Status(http.StatusOK) })

	hitFrom := func(addr string) int {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.RemoteAddr = addr
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	if c := hitFrom("10.0.0.2:1"); c != http.StatusOK {
		t.Fatalf("ip A first: got %d want 200", c)
	}
	if c := hitFrom("10.0.0.3:1"); c != http.StatusOK {
		t.Fatalf("ip B first: got %d want 200 (limit should be per-IP)", c)
	}
	if c := hitFrom("10.0.0.2:1"); c != http.StatusTooManyRequests {
		t.Fatalf("ip A second: got %d want 429", c)
	}
}
