package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"changenow/api-go/internal/http/middleware"
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
	SetNumber int     `json:"set_number" binding:"required"`
	Weight    float64 `json:"weight" binding:"required"`
	Reps      int     `json:"reps" binding:"required"`
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
	err := h.db.QueryRow(context.Background(),
		`SELECT user_id FROM exercises WHERE id = $1`, req.ExerciseID,
	).Scan(&ownerID)
	if err != nil || ownerID != uid {
		c.JSON(http.StatusNotFound, gin.H{"error": "exercise not found"})
		return
	}

	createdAt := time.Now()

	// 开始事务 — workout_log 和 workout_sets 要么全成功要么全失败
	tx, err := h.db.Begin(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer tx.Rollback(context.Background()) // 如果没 commit 会自动 rollback

	// 1. workout_log
	var logID int64
	var existingVolume float64

	err = tx.QueryRow(context.Background(),
		`select id, volume
	 from workout_logs
	 where performed_at = $1 and user_id = $2`,
		createdAt, uid).Scan(&logID, &existingVolume)

	if err != nil {
		if err == pgx.ErrNoRows {
			err = tx.QueryRow(context.Background(),
				`INSERT INTO workout_logs (user_id, performed_at, volume,notes)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id`,
				uid, createdAt, totalVolume, req.Notes,
			).Scan(&logID)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database fail"})
			return
		}
	} else {
		err = tx.QueryRow(context.Background(),
			`UPDATE workout_logs
		SET volume = $1
		WHERE performed_at = $2 AND id = $3
		RETURNING id`,
			existingVolume+totalVolume, createdAt, logID).Scan(&logID)
	}

	// 2. 插入每一组

	var set_num int
	err = tx.QueryRow(context.Background(), `
	SELECT set_number
	FROM workout_sets
	WHERE workout_log_id = $1 AND exercise_id = $2
	ORDER BY set_number DESC
	LIMIT 1`,
		logID, req.ExerciseID).Scan(&set_num)
	if err == pgx.ErrNoRows {
		set_num = 0
	}

	for _, s := range req.Sets {

		_, err = tx.Exec(context.Background(),
			`INSERT INTO workout_sets (workout_log_id, exercise_id, set_number, weight, reps)
			 VALUES ($1, $2, $3, $4, $5)`,
			logID, req.ExerciseID, s.SetNumber+set_num, s.Weight, s.Reps,
		)
		if err != nil {
			fmt.Print(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to insert set"})
			return
		}
	}

	if err = tx.Commit(context.Background()); err != nil {
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
	rows, err := h.db.Query(context.Background(),
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

	// 1. 查这个 exercise 下所有的 workout_logs
	rows, err := h.db.Query(context.Background(),
		`SELECT wl.id, wl.performed_at, wl.notes, wl.volume, wl.calories
		 FROM workout_logs wl
		 WHERE wl.user_id = $1
		 ORDER BY wl.performed_at DESC
		 LIMIT 20`,
		uid,
	)
	fmt.Print(err)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query history"})
		return
	}
	defer rows.Close()

	logs := []workoutLogResp{}
	for rows.Next() {
		var log workoutLogResp
		if err := rows.Scan(&log.ID, &log.PerformedAt, &log.Notes, &log.Volume, &log.Calories); err != nil {
			continue
		}
		logs = append(logs, log)
	}

	c.JSON(http.StatusOK, gin.H{"history": logs})
}

func (h *Handlers) GetDailyExercisesDetails(c *gin.Context) {
	uid := c.GetInt64(middleware.CtxUserIDKey)
	workoutID := c.Param("id")

	// 1. 查这个 exercise 下所有的 workout_logs
	rows, err := h.db.Query(context.Background(),
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

	// WHERE 里加 user_id 确保用户只能删自己的
	result, err := h.db.Exec(context.Background(),
		`DELETE FROM workout_sets ws
     USING workout_logs wl
     WHERE ws.workout_log_id = wl.id
       AND ws.id = $1
       AND wl.user_id = $2`,
		setID, uid,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete"})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "set not found"})
		return
	}

	_, err = h.db.Exec(context.Background(),
		`UPDATE workout_logs wl
		 SET volume = COALESCE((
			 SELECT SUM(ws.weight * ws.reps)
			 FROM workout_sets ws
			 WHERE ws.workout_log_id = wl.id
		 ), 0)
		 WHERE wl.user_id = $1`,
		uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update volume"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
