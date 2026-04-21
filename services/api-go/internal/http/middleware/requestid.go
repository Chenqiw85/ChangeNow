package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDKey = "request_id"
const RequestIDHeader = "X-Request-ID"

// RequestID generates a unique ID for each request.
// If the client already sent X-Request-ID, reuse it (useful for debugging).
// The ID is stored in the Gin context and echoed back in the response header.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if client sent a request ID
		id := c.GetHeader(RequestIDHeader)
		if id == "" {
			id = uuid.New().String()
		}

		// Store in context (other middleware and handlers can read it)
		c.Set(RequestIDKey, id)

		// Echo back in response header
		c.Header(RequestIDHeader, id)

		c.Next()
	}
}
