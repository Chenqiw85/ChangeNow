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
