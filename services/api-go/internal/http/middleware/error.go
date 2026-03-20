package middleware

import "github.com/gin-gonic/gin"

// ErrorResponse is the standard error format for all API errors.
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    string `json:"code,omitempty"`
}

// NewError is a helper to create consistent error responses in handlers.
func NewError(c *gin.Context, status int, errType string, message string) {
	c.JSON(status, ErrorResponse{
		Error:   errType,
		Message: message,
	})
}
