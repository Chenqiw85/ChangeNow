package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"changenow/api-go/internal/ai"
	"changenow/api-go/internal/cache"
	"changenow/api-go/internal/logger"
	"changenow/api-go/internal/metrics"
)

// PlanHandler processes plan generation tasks from the queue.
type PlanHandler struct {
	db       *pgxpool.Pool
	aiClient *ai.Client
	cache    *cache.RedisClient
}

func NewPlanHandler(db *pgxpool.Pool, aiClient *ai.Client, rc *cache.RedisClient) *PlanHandler {
	return &PlanHandler{db: db, aiClient: aiClient, cache: rc}
}

// HandlePlanGenerate is called by Asynq when a plan:generate task is dequeued.
func (h *PlanHandler) HandlePlanGenerate(ctx context.Context, t *asynq.Task) error {
	// 1. Deserialize payload
	var payload PlanGeneratePayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	logger.Log.Info("worker: processing plan generation",
		zap.String("task_id", payload.TaskID),
		zap.Int64("user_id", payload.UserID),
		zap.String("request_id", payload.RequestID),
	)

	// 2. Update task status to "running"
	_, _ = h.db.Exec(ctx,
		`UPDATE tasks SET status='running', started_at=$2 WHERE id=$1`,
		payload.TaskID, time.Now(),
	)

	// 3. Call AI service
	aiRequest := ai.GenerateRequest{
		Goal:          payload.Goal,
		DaysPerWeek:   payload.DaysPerWeek,
		Equipment:     payload.Equipment,
		Constraints:   payload.Constraints,
		PromptVersion: payload.PromptVersion,
	}

	var aiResp *ai.GenerateResponse
	var err error

	if payload.UseAgent {
		aiResp, err = h.aiClient.GenerateWithAgent(ctx, aiRequest, payload.RequestID)
	} else {
		aiResp, err = h.aiClient.Generate(ctx, aiRequest, payload.RequestID)
	}

	if err != nil {
		// Mark task as failed
		_, _ = h.db.Exec(ctx,
			`UPDATE tasks SET status='failed', error_message=$2, finished_at=$3 WHERE id=$1`,
			payload.TaskID, err.Error(), time.Now(),
		)
		metrics.LLMRequestsTotal.WithLabelValues("unknown", "error").Inc()

		logger.Log.Error("worker: AI service failed",
			zap.String("task_id", payload.TaskID),
			zap.Error(err),
		)

		// Return error so Asynq retries
		return fmt.Errorf("AI service call failed: %w", err)
	}

	// 4. Store plan in database
	planID := uuid.New()
	_, err = h.db.Exec(ctx,
		`INSERT INTO plans(id, user_id, goal, days_per_week, equipment, constraints,
		                   plan_text, prompt_version, pipeline_version)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		planID, payload.UserID, payload.Goal, payload.DaysPerWeek,
		payload.Equipment, payload.Constraints,
		aiResp.PlanText, aiResp.PromptVersion,
		aiResp.Provider+"/"+aiResp.Model,
	)
	if err != nil {
		return fmt.Errorf("save plan to database: %w", err)
	}

	// 4b. Warm the plan cache so subsequent /plans/generate requests with the
	// same inputs can short-circuit without a full LLM round-trip. Best effort:
	// a cache failure must not fail the task.
	if h.cache != nil {
		key := cache.PlanCacheKey(payload.UserID, payload.Goal, payload.DaysPerWeek,
			payload.Equipment, payload.Constraints, payload.PromptVersion, payload.UseAgent)
		body, err := json.Marshal(map[string]string{
			"id":        planID.String(),
			"plan_text": aiResp.PlanText,
		})
		if err != nil {
			logger.Log.Warn("worker: marshal cache entry", zap.Error(err))
		} else if err := h.cache.SetCachedPlan(ctx, key, body, 24*time.Hour); err != nil {
			logger.Log.Warn("worker: write plan cache", zap.Error(err))
		}
	}

	// 5. Mark task as done
	_, _ = h.db.Exec(ctx,
		`UPDATE tasks SET status='done', plan_id=$2, finished_at=$3 WHERE id=$1`,
		payload.TaskID, planID, time.Now(),
	)

	// 6. Record metrics
	metrics.LLMRequestsTotal.WithLabelValues(aiResp.Provider, "success").Inc()
	metrics.LLMTokensTotal.WithLabelValues(aiResp.Provider).Add(float64(aiResp.TotalTokens))
	metrics.LLMLatency.WithLabelValues(aiResp.Provider).Observe(aiResp.LatencyMs / 1000)

	logger.Log.Info("worker: plan generation completed",
		zap.String("task_id", payload.TaskID),
		zap.String("plan_id", planID.String()),
		zap.String("provider", aiResp.Provider),
		zap.Int("tokens", aiResp.TotalTokens),
	)

	return nil
}
