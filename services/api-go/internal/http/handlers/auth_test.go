package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"

	"changenow/api-go/internal/testutil"
)

func newAuthRouter(t *testing.T) (*gin.Engine, *Handlers) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	pool := testutil.PGPool(t)
	h := &Handlers{db: pool}
	r := gin.New()
	r.POST("/auth/register", h.Register)
	r.POST("/auth/login", h.Login)
	return r, h
}

func postJSON(t *testing.T, r *gin.Engine, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	buf, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestRegisterAndLogin_Roundtrip(t *testing.T) {
	t.Setenv("JWT_SECRET", "unit-test-secret")
	r, _ := newAuthRouter(t)

	w := postJSON(t, r, "/auth/register", map[string]string{
		"email":    "alice@example.com",
		"password": "hunter2!!",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("register: got %d want 201 (body=%s)", w.Code, w.Body.String())
	}
	var reg map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &reg); err != nil {
		t.Fatalf("decode register: %v", err)
	}
	if reg["access_token"] == "" || reg["access_token"] == nil {
		t.Fatalf("register: missing access_token: %v", reg)
	}

	w = postJSON(t, r, "/auth/login", map[string]string{
		"email":    "alice@example.com",
		"password": "hunter2!!",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("login: got %d want 200 (body=%s)", w.Code, w.Body.String())
	}
	var log map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &log); err != nil {
		t.Fatalf("decode login: %v", err)
	}
	if log["access_token"] == "" || log["access_token"] == nil {
		t.Fatalf("login: missing access_token: %v", log)
	}
}

func TestRegister_DuplicateEmailReturns409(t *testing.T) {
	t.Setenv("JWT_SECRET", "unit-test-secret")
	r, _ := newAuthRouter(t)

	body := map[string]string{"email": "dup@example.com", "password": "hunter2!!"}
	if w := postJSON(t, r, "/auth/register", body); w.Code != http.StatusCreated {
		t.Fatalf("first register: got %d want 201 (body=%s)", w.Code, w.Body.String())
	}
	w := postJSON(t, r, "/auth/register", body)
	if w.Code != http.StatusConflict {
		t.Fatalf("second register: got %d want 409 (body=%s)", w.Code, w.Body.String())
	}
}

func TestRegister_MissingSecretReturns500NoToken(t *testing.T) {
	_ = os.Unsetenv("JWT_SECRET")
	r, _ := newAuthRouter(t)

	w := postJSON(t, r, "/auth/register", map[string]string{
		"email":    "nosecret@example.com",
		"password": "hunter2!!",
	})
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("got %d want 500 (body=%s)", w.Code, w.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, ok := resp["access_token"]; ok {
		t.Fatalf("response must not contain access_token: %v", resp)
	}
}

func TestLogin_BadCredentialsReturns401(t *testing.T) {
	t.Setenv("JWT_SECRET", "unit-test-secret")
	r, _ := newAuthRouter(t)

	if w := postJSON(t, r, "/auth/register", map[string]string{
		"email":    "bob@example.com",
		"password": "correct-horse",
	}); w.Code != http.StatusCreated {
		t.Fatalf("register: %d (%s)", w.Code, w.Body.String())
	}

	w := postJSON(t, r, "/auth/login", map[string]string{
		"email":    "bob@example.com",
		"password": "wrong",
	})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("got %d want 401 (body=%s)", w.Code, w.Body.String())
	}
}
