package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"changenow/api-go/internal/ai"
	"changenow/api-go/internal/http/middleware"
)

type generatePlanReq struct {
	Goal              string `json:"goal" binding:"required"`
	DaysPerWeek       int    `json:"days_per_week" binding:"required,min=1,max=7"`
	Equipment         string `json:"equipment"`
	Constraints       string `json:"constraints"`
	PromptVersion     string `json:"prompt_version"`
	PreferredProvider string `json:"preferred_provider"`
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

	taskID := uuid.New()
	planID := uuid.New()
	now := time.Now()

	// 1. Insert task as "running"
	_, err := h.db.Exec(context.Background(),
		`INSERT INTO tasks(id, user_id, status, created_at, started_at)
		 VALUES ($1, $2, 'running', $3, $3)`,
		taskID, uid, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create task"})
		return
	}

	// 2. Call Python AI service
	aiResp, err := h.aiClient.Generate(c.Request.Context(), ai.GenerateRequest{
		Goal:              req.Goal,
		DaysPerWeek:       req.DaysPerWeek,
		Equipment:         req.Equipment,
		Constraints:       req.Constraints,
		PromptVersion:     req.PromptVersion,
		PreferredProvider: req.PreferredProvider,
	})

	if err != nil {
		// AI service failed — mark task as failed
		_, _ = h.db.Exec(context.Background(),
			`UPDATE tasks SET status='failed', error_message=$2, finished_at=$3 WHERE id=$1`,
			taskID, err.Error(), time.Now(),
		)
		c.JSON(http.StatusBadGateway, gin.H{
			"error":   "AI service failed",
			"detail":  err.Error(),
			"task_id": taskID.String(),
		})
		return
	}

	// 3. Store plan in database
	_, err = h.db.Exec(context.Background(),
		`INSERT INTO plans(id, user_id, goal, days_per_week, equipment, constraints,
		                   plan_text, prompt_version, pipeline_version)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		planID, uid, req.Goal, req.DaysPerWeek, req.Equipment, req.Constraints,
		aiResp.PlanText, aiResp.PromptVersion,
		aiResp.Provider+"/"+aiResp.Model, // e.g. "openai/gpt-4o"
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save plan"})
		return
	}

	// 4. Mark task as done
	_, _ = h.db.Exec(context.Background(),
		`UPDATE tasks SET status='done', plan_id=$2, finished_at=$3 WHERE id=$1`,
		taskID, planID, time.Now(),
	)

	// 5. Return response
	c.JSON(http.StatusOK, gin.H{
		"task_id":        taskID.String(),
		"plan_id":        planID.String(),
		"status":         "done",
		"provider":       aiResp.Provider,
		"model":          aiResp.Model,
		"prompt_version": aiResp.PromptVersion,
		"total_tokens":   aiResp.TotalTokens,
		"latency_ms":     aiResp.LatencyMs,
	})
}