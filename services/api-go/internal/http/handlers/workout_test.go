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
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func seedExercise(t *testing.T, h *Handlers, uid int64) int64 {
	t.Helper()
	var id int64
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO exercises(user_id,name) VALUES($1,$2) RETURNING id`,
		uid, "Bench Press").Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func newWorkoutRouter(t *testing.T) (*gin.Engine, *Handlers, int64, int64) {
	t.Helper()
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
	return r, h, uid, exid
}

func postWorkout(t *testing.T, r *gin.Engine, payload map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/workouts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestLogWorkout_SameDay_AppendsToSameLog(t *testing.T) {
	r, h, uid, exid := newWorkoutRouter(t)

	payload := func(sets []map[string]any) map[string]any {
		return map[string]any{"exercise_id": exid, "sets": sets}
	}
	if w := postWorkout(t, r, payload([]map[string]any{{"set_number": 1, "weight": 100.0, "reps": 5}})); w.Code != http.StatusCreated {
		t.Fatalf("first log: got %d (body=%s)", w.Code, w.Body.String())
	}
	if w := postWorkout(t, r, payload([]map[string]any{{"set_number": 1, "weight": 105.0, "reps": 5}})); w.Code != http.StatusCreated {
		t.Fatalf("second log: got %d (body=%s)", w.Code, w.Body.String())
	}

	var logCount int
	if err := h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM workout_logs WHERE user_id=$1`, uid).Scan(&logCount); err != nil {
		t.Fatal(err)
	}
	if logCount != 1 {
		t.Fatalf("expected 1 workout_log per day, got %d", logCount)
	}

	var volume float64
	if err := h.db.QueryRow(context.Background(),
		`SELECT volume FROM workout_logs WHERE user_id=$1`, uid).Scan(&volume); err != nil {
		t.Fatal(err)
	}
	want := 100.0*5 + 105.0*5
	if volume != want {
		t.Fatalf("volume: got %v want %v", volume, want)
	}
}
