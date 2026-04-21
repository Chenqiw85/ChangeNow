package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"changenow/api-go/internal/cache"
	"changenow/api-go/internal/metrics"
)

// RateLimiter returns a Gin middleware that limits requests per user.
// limit: max requests in the window
// window: sliding window duration
func RateLimiter(redisClient *cache.RedisClient, limit int64, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from JWT (set by AuthRequired middleware)
		uid, exists := c.Get(CtxUserIDKey)
		if !exists {
			// No user ID means not authenticated — let other middleware handle it
			c.Next()
			return
		}

		key := fmt.Sprintf("ratelimit:user:%d", uid.(int64))

		result, err := redisClient.CheckRateLimit(c.Request.Context(), key, limit, window)
		if err != nil {
			// If Redis is down, log and allow the request (fail open)
			c.Next()
			return
		}

		// Set rate limit headers (standard convention)
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

// RateLimiterByIP limits requests per client IP. Intended for unauthenticated
// routes (e.g. /auth/register, /auth/login) where no user ID exists yet.
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
			// Fail open: if Redis is unreachable, don't lock users out.
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
