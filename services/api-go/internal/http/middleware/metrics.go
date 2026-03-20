package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"

	"changenow/api-go/internal/metrics"
)

// Metrics records Prometheus metrics for every HTTP request.
func Metrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		// Record metrics after request completes
		duration := time.Since(start).Seconds()
		status := fmt.Sprintf("%d", c.Writer.Status())
		path := c.FullPath() // use route pattern, not actual path (avoids high cardinality)
		if path == "" {
			path = "unknown"
		}
		method := c.Request.Method

		metrics.RequestsTotal.WithLabelValues(method, path, status).Inc()
		metrics.RequestDuration.WithLabelValues(method, path).Observe(duration)
	}
}