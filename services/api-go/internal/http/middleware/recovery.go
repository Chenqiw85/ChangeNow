package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"changenow/api-go/internal/logger"
)

// Recovery replaces Gin's default recovery middleware with structured logging.
// Returns a consistent JSON error format for panics.
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Log the panic with full context
				logger.Log.Error("panic recovered",
					zap.Any("error", err),
					zap.String("path", c.Request.URL.Path),
					zap.String("method", c.Request.Method),
				)

				// Return consistent error format
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error":   "internal server error",
					"message": "An unexpected error occurred. Please try again.",
				})
			}
		}()

		c.Next()
	}
}
