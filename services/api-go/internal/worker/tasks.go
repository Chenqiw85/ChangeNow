package worker

import (
	"encoding/json"

	"github.com/hibiken/asynq"
)

// Task type names — used as routing keys in the queue
const (
	TypePlanGenerate = "plan:generate"
)

// PlanGeneratePayload is the data passed to the worker.
// Contains everything needed to generate a plan without access to the HTTP request.
type PlanGeneratePayload struct {
	TaskID        string `json:"task_id"`
	UserID        int64  `json:"user_id"`
	Goal          string `json:"goal"`
	DaysPerWeek   int    `json:"days_per_week"`
	Equipment     string `json:"equipment"`
	Constraints   string `json:"constraints"`
	PromptVersion string `json:"prompt_version"`
	UseAgent      bool   `json:"use_agent"`
	RequestID     string `json:"request_id"` // for distributed tracing
}

// NewPlanGenerateTask creates a new Asynq task with the given payload.
func NewPlanGenerateTask(payload PlanGeneratePayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	return asynq.NewTask(
		TypePlanGenerate,
		data,
		asynq.MaxRetry(3),      // retry up to 3 times on failure
		asynq.Timeout(120*1e9), // 120 second timeout (nanoseconds)
		asynq.Queue("default"), // queue name
	), nil
}
