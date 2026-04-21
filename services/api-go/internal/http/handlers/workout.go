package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"changenow/api-go/internal/http/middleware"
	"changenow/api-go/internal/logger"
)

// ─── Request 结构体 ─────────────────────────────────

// 前端提交一次训练记录：哪个exercise、哪天、几组
type logWorkoutReq struct {
	ExerciseID int64     `json:"exercise_id" binding:"required"`
	CreatedAt  time.Time `json:"created_at"` // "2025-03-15" 格式，空则用今天
	Notes      string    `json:"notes"`
	Sets       []setReq  `json:"sets" binding:"required,min=1"`
}

type setReq struct {
	// SetNumber is ignored from the request body — the server assigns
	// set_number relative to what's already stored for (workout_log, exercise).
	Weight float64 `json:"weight" binding:"required"`
	Reps   int     `json:"reps"   binding:"required"`
}

// ─── Response 结构体 ────────────────────────────────

type workoutLogResp struct {
	ID          int64     `json:"id"`
	Volume      float64   `json:"volume"`
	Calories    int       `json:"calories"`
	PerformedAt time.Time `json:"performed_at"`
	Notes       string    `json:"notes"`
}

type setResp struct {
	WorkoutID    int64     `json:"workout_log_id"`
	ExerciseID   int64     `json:"exercise_id"`
	ExerciseName string    `json:"exercise_name"`
	ExerciseType string    `json:"exercise_type"`
	CreatedAt    time.Time `json:"created_at"`
	Sets         []setItem `json:"sets"`
}

type setItem struct {
	ID        int64   `json:"id"`
	SetNumber int     `json:"set_number"`
	Weight    float64 `json:"weight"`
	Reps      int     `json:"reps"`
}

// ─── record exercise ────────────────────────────────────
// POST /v1/workouts
func (h *Handlers) LogWorkout(c *gin.Context) {
	uid := c.GetInt64(middleware.CtxUserIDKey)

	var req logWorkoutReq

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var totalVolume float64
	for _, s := range req.Sets {
		totalVolume += s.Weight * float64(s.Reps)
	}

	var ownerID int64
	err := h.db.QueryRow(c.Request.Context(),
		`SELECT user_id FROM exercises WHERE id = $1`, req.ExerciseID,
	).Scan(&ownerID)
	if err != nil || ownerID != uid {
		c.JSON(http.StatusNotFound, gin.H{"error": "exercise not found"})
		return
	}

	// workout_log 和 workout_sets 要么全成功要么全失败
	tx, err := h.db.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer tx.Rollback(c.Request.Context()) // 如果没 commit 会自动 rollback

	// 1. Upsert the workout_log row for today. One log per user per day
	// (enforced by the workout_logs_user_day_unique constraint, migration 003).
	var logID int64
	err = tx.QueryRow(c.Request.Context(),
		`INSERT INTO workout_logs (user_id, performed_at, volume, notes)
		 VALUES ($1, CURRENT_DATE, $2, $3)
		 ON CONFLICT (user_id, performed_at) DO UPDATE
		 SET volume = workout_logs.volume + EXCLUDED.volume,
		     notes  = CASE WHEN EXCLUDED.notes <> '' THEN EXCLUDED.notes ELSE workout_logs.notes END
		 RETURNING id`,
		uid, totalVolume, req.Notes,
	).Scan(&logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upsert workout log"})
		return
	}

	// 2. Compute starting set_number for this (log, exercise) so the sequence
	// stays 1..N regardless of what the client sent.
	var startNum int
	err = tx.QueryRow(c.Request.Context(),
		`SELECT COALESCE(MAX(set_number), 0)
		 FROM workout_sets
		 WHERE workout_log_id = $1 AND exercise_id = $2`,
		logID, req.ExerciseID,
	).Scan(&startNum)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute set number"})
		return
	}

	for i, s := range req.Sets {
		_, err = tx.Exec(c.Request.Context(),
			`INSERT INTO workout_sets (workout_log_id, exercise_id, set_number, weight, reps)
			 VALUES ($1, $2, $3, $4, $5)`,
			logID, req.ExerciseID, startNum+i+1, s.Weight, s.Reps,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to insert set"})
			return
		}
	}

	if err = tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"workout_log_id": logID})
}

// ─── get exercise history ────────────────────
// GET /v1/exercises/:id/history
func (h *Handlers) GetExerciseHistory(c *gin.Context) {
	uid := c.GetInt64(middleware.CtxUserIDKey)
	exerciseID := c.Param("id")

	// 1. 查这个 exercise 下所有的 workout_logs
	rows, err := h.db.Query(c.Request.Context(),
		`SELECT ws.workout_log_id, ws.exercise_id, e.name, e.type, ws.created_at,ws.id, ws.set_number, ws.weight,ws.reps
		 FROM workout_sets ws
		 JOIN exercises e ON e.id = ws.exercise_id
		 JOIN workout_logs wl ON wl.id = ws.workout_log_id
		 WHERE ws.exercise_id = $1 AND wl.user_id = $2
		 ORDER BY wl.performed_at DESC
		 `,
		exerciseID, uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query history"})
		return
	}
	defer rows.Close()

	history := []setResp{}
	var current *setResp
	for rows.Next() {
		var (
			set          setItem
			workoutLogID int64
			group        setResp
		)
		if err := rows.Scan(&workoutLogID, &group.ExerciseID, &group.ExerciseName, &group.ExerciseType, &group.CreatedAt, &set.ID, &set.SetNumber, &set.Weight, &set.Reps); err != nil {
			logger.Log.Warn("scan exercise history row", zap.Int64("user_id", uid), zap.Error(err))
			continue
		}
		if current == nil || current.WorkoutID != workoutLogID {
			history = append(history, setResp{
				WorkoutID:    workoutLogID,
				ExerciseID:   group.ExerciseID,
				ExerciseName: group.ExerciseName,
				ExerciseType: group.ExerciseType,
				CreatedAt:    group.CreatedAt,
				Sets:         []setItem{},
			})
			current = &history[len(history)-1]
		}

		current.Sets = append(current.Sets, set)
	}

	c.JSON(http.StatusOK, gin.H{"history": history})
}

// --- fetch all exercises history-------
// GET /v1/exercises/history
func (h *Handlers) GetDailyExercisesHistory(c *gin.Context) {
	uid := c.GetInt64(middleware.CtxUserIDKey)

	rows, err := h.db.Query(c.Request.Context(),
		`SELECT wl.id, wl.performed_at, wl.notes, wl.volume, wl.calories
		 FROM workout_logs wl
		 WHERE wl.user_id = $1
		 ORDER BY wl.performed_at DESC
		 LIMIT 20`,
		uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query history"})
		return
	}
	defer rows.Close()

	logs := []workoutLogResp{}
	for rows.Next() {
		var wl workoutLogResp
		if err := rows.Scan(&wl.ID, &wl.PerformedAt, &wl.Notes, &wl.Volume, &wl.Calories); err != nil {
			logger.Log.Warn("scan daily history row", zap.Int64("user_id", uid), zap.Error(err))
			continue
		}
		logs = append(logs, wl)
	}

	c.JSON(http.StatusOK, gin.H{"history": logs})
}

func (h *Handlers) GetDailyExercisesDetails(c *gin.Context) {
	uid := c.GetInt64(middleware.CtxUserIDKey)
	workoutID := c.Param("id")

	rows, err := h.db.Query(c.Request.Context(),
		`SELECT ws.workout_log_id, ws.exercise_id, e.name, e.type, ws.created_at,ws.id, ws.set_number, ws.weight,ws.reps
		 FROM workout_sets ws
		 JOIN exercises e ON e.id = ws.exercise_id
		 JOIN workout_logs wl ON wl.id = ws.workout_log_id
		 WHERE ws.workout_log_id = $1 AND wl.user_id = $2
		 ORDER BY ws.exercise_id ASC, ws.set_number ASC
		 `,
		workoutID, uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query history"})
		return
	}
	defer rows.Close()

	history := []setResp{}
	var current *setResp
	for rows.Next() {
		var (
			set        setItem
			exerciseID int64
			group      setResp
		)
		if err := rows.Scan(&group.WorkoutID, &exerciseID, &group.ExerciseName, &group.ExerciseType, &group.CreatedAt, &set.ID, &set.SetNumber, &set.Weight, &set.Reps); err != nil {
			logger.Log.Warn("scan daily details row", zap.Int64("user_id", uid), zap.Error(err))
			continue
		}
		if current == nil || current.ExerciseID != exerciseID {
			history = append(history, setResp{
				WorkoutID:    group.WorkoutID,
				ExerciseID:   exerciseID,
				ExerciseName: group.ExerciseName,
				ExerciseType: group.ExerciseType,
				CreatedAt:    group.CreatedAt,
				Sets:         []setItem{},
			})
			current = &history[len(history)-1]
		}

		current.Sets = append(current.Sets, set)
	}
	c.JSON(http.StatusOK, gin.H{"history": history})
}

func (h *Handlers) DeleteSet(c *gin.Context) {
	uid := c.GetInt64(middleware.CtxUserIDKey)
	setID := c.Param("id")

	// RETURNING lets us scope the volume recompute below to the one affected
	// log instead of every log this user has ever recorded.
	var logID int64
	err := h.db.QueryRow(c.Request.Context(),
		`DELETE FROM workout_sets ws
		 USING workout_logs wl
		 WHERE ws.workout_log_id = wl.id
		   AND ws.id = $1
		   AND wl.user_id = $2
		 RETURNING ws.workout_log_id`,
		setID, uid,
	).Scan(&logID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "set not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete"})
		return
	}

	_, err = h.db.Exec(c.Request.Context(),
		`UPDATE workout_logs
		 SET volume = COALESCE((
		     SELECT SUM(weight * reps) FROM workout_sets WHERE workout_log_id = $1
		 ), 0)
		 WHERE id = $1`,
		logID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update volume"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
