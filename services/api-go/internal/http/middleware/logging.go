package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"changenow/api-go/internal/logger"
)

// Logging replaces Gin's default logger with structured Zap logging.
// Logs every request with method, path, status, latency, user_id, and request_id.
func Logging() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process the request
		c.Next()

		// After request is done, log it
		latency := time.Since(start)

		// Build structured fields
		fields := []zap.Field{
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Float64("latency_ms", float64(latency.Milliseconds())),
			zap.String("client_ip", c.ClientIP()),
		}

		// Add request_id if present
		if reqID, exists := c.Get(RequestIDKey); exists {
			fields = append(fields, zap.String("request_id", reqID.(string)))
		}

		// Add user_id if authenticated
		if uid, exists := c.Get(CtxUserIDKey); exists {
			fields = append(fields, zap.Int64("user_id", uid.(int64)))
		}

		// Add error if any
		if len(c.Errors) > 0 {
			fields = append(fields, zap.String("error", c.Errors.String()))
		}

		// Log level based on status code
		status := c.Writer.Status()
		switch {
		case status >= 500:
			logger.Log.Error("request completed", fields...)
		case status >= 400:
			logger.Log.Warn("request completed", fields...)
		default:
			logger.Log.Info("request completed", fields...)
		}
	}
}
