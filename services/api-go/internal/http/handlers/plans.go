package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"changenow/api-go/internal/cache"
	"changenow/api-go/internal/http/middleware"
	"changenow/api-go/internal/logger"
	"changenow/api-go/internal/metrics"
	"changenow/api-go/internal/worker"
)

type generatePlanReq struct {
	Goal              string `json:"goal" binding:"required"`
	DaysPerWeek       int    `json:"days_per_week" binding:"required,min=1,max=7"`
	Equipment         string `json:"equipment"`
	Constraints       string `json:"constraints"`
	PromptVersion     string `json:"prompt_version"`
	PreferredProvider string `json:"preferred_provider"`
	UseAgent          bool   `json:"use_agent"`
}

func (h *Handlers) GeneratePlan(c *gin.Context) {
	uid := c.GetInt64(middleware.CtxUserIDKey)

	var req generatePlanReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Defaults
	if req.PromptVersion == "" {
		req.PromptVersion = "v1"
	}
	if req.Equipment == "" {
		req.Equipment = "full gym"
	}
	if req.Constraints == "" {
		req.Constraints = "none"
	}

	// Check cache first
	cacheKey := cache.PlanCacheKey(uid, req.Goal, req.DaysPerWeek, req.Equipment, req.Constraints, req.PromptVersion)
	if h.cache != nil {
		if cached, err := h.cache.GetCachedPlan(c.Request.Context(), cacheKey); err == nil && cached != nil {
			metrics.CacheHits.WithLabelValues("hit").Inc()
			c.Data(http.StatusOK, "application/json", cached)
			return
		}
		metrics.CacheHits.WithLabelValues("miss").Inc()
	}

	taskID := uuid.New()
	requestID := c.GetString(middleware.RequestIDKey)

	// 1. Insert task as "pending"
	_, err := h.db.Exec(context.Background(),
		`INSERT INTO tasks(id, user_id, status, created_at)
		 VALUES ($1, $2, 'pending', $3)`,
		taskID, uid, time.Now(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create task"})
		return
	}

	// 2. Enqueue task to Asynq
	payload := worker.PlanGeneratePayload{
		TaskID:        taskID.String(),
		UserID:        uid,
		Goal:          req.Goal,
		DaysPerWeek:   req.DaysPerWeek,
		Equipment:     req.Equipment,
		Constraints:   req.Constraints,
		PromptVersion: req.PromptVersion,
		UseAgent:      req.UseAgent,
		RequestID:     requestID,
	}

	task, err := worker.NewPlanGenerateTask(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create task"})
		return
	}

	_, err = h.queue.Enqueue(task)
	if err != nil {
		logger.Log.Error("failed to enqueue task", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue task"})
		return
	}

	// 3. Return immediately with task ID
	c.JSON(http.StatusAccepted, gin.H{
		"task_id": taskID.String(),
		"status":  "pending",
		"message": "Plan generation started. Poll GET /v1/tasks/:id for status.",
	})
}
