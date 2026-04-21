package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"changenow/api-go/internal/http/middleware"
	"changenow/api-go/internal/logger"
)

// ─── Request / Response 结构体 ──────────────────────

// 创建训练动作的请求body
type createExerciseReq struct {
	Name        string `json:"name" binding:"required"`
	Type        string `json:"type"`
	Description string `json:"description"`
}

// 返回给前端的训练动作数据
type exerciseResp struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

// ─── 获取当前用户的所有训练动作 ──────────────────────
// GET /v1/exercises
func (h *Handlers) ListExercises(c *gin.Context) {
	// 从 JWT middleware 里拿到当前用户ID
	uid := c.GetInt64(middleware.CtxUserIDKey)

	rows, err := h.db.Query(c.Request.Context(),
		`SELECT id, name, type, description, created_at
		 FROM exercises
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query exercises"})
		return
	}
	defer rows.Close()

	// 把查询结果收集到 slice 里
	exercises := []exerciseResp{}
	for rows.Next() {
		var e exerciseResp
		if err := rows.Scan(&e.ID, &e.Name, &e.Type, &e.Description, &e.CreatedAt); err != nil {
			// 跳过有问题的行，但记一条日志方便排查
			logger.Log.Warn("scan exercise row", zap.Int64("user_id", uid), zap.Error(err))
			continue
		}
		exercises = append(exercises, e)
	}

	c.JSON(http.StatusOK, gin.H{"exercises": exercises})
}

// ─── 创建新的训练动作 ────────────────────────────────
// POST /v1/exercises
func (h *Handlers) CreateExercise(c *gin.Context) {
	uid := c.GetInt64(middleware.CtxUserIDKey)

	var req createExerciseReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 设置默认type
	if req.Type == "" {
		req.Type = "Strength training"
	}

	var id int64
	var createdAt time.Time
	err := h.db.QueryRow(c.Request.Context(),
		`INSERT INTO exercises (user_id, name, type, description)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, created_at`,
		uid, req.Name, req.Type, req.Description,
	).Scan(&id, &createdAt)

	if err != nil {
		// 大概率是 UNIQUE 约束冲突（同名训练已存在）
		c.JSON(http.StatusConflict, gin.H{"error": "exercise with this name already exists"})
		return
	}

	c.JSON(http.StatusCreated, exerciseResp{
		ID:          id,
		Name:        req.Name,
		Type:        req.Type,
		Description: req.Description,
		CreatedAt:   createdAt,
	})
}

// ─── 删除训练动作 ────────────────────────────────────
// DELETE /v1/exercises/:id
func (h *Handlers) DeleteExercise(c *gin.Context) {
	uid := c.GetInt64(middleware.CtxUserIDKey)
	exerciseID := c.Param("id")

	// WHERE 里加 user_id 确保用户只能删自己的
	result, err := h.db.Exec(c.Request.Context(),
		`DELETE FROM exercises WHERE id = $1 AND user_id = $2`,
		exerciseID, uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete"})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "exercise not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
