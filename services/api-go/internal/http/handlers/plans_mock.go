package handlers

import (
  "context"
  "net/http"
  "time"

  "github.com/gin-gonic/gin"
  "github.com/google/uuid"

  "changenow/api-go/internal/http/middleware"
)

type genReq struct {
  Goal        string `json:"goal"`
  DaysPerWeek int    `json:"days_per_week"`
  Equipment   string `json:"equipment"`
  Constraints string `json:"constraints"`
}

func (h *Handlers) GeneratePlanMock(c *gin.Context) {
  uid := c.GetInt64(middleware.CtxUserIDKey)

  var req genReq
  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
    return
  }

  taskID := uuid.New()
  planID := uuid.New()

  // 1) 先插入 tasks(pending)
  _, _ = h.db.Exec(context.Background(),
    `insert into tasks(id, user_id, status, created_at) values ($1,$2,'pending',$3)`,
    taskID, uid, time.Now(),
  )

  // 2) mock 直接生成 plan + 更新 task done（Phase1 先这样）
  planText := "Mock Plan v1: Day1 squat... Day2 push... (replace with AI later)"
  _, _ = h.db.Exec(context.Background(),
    `insert into plans(id,user_id,goal,days_per_week,equipment,constraints,plan_text,prompt_version,pipeline_version)
     values ($1,$2,$3,$4,$5,$6,$7,'v1','v1')`,
    planID, uid, req.Goal, req.DaysPerWeek, req.Equipment, req.Constraints, planText,
  )

  _, _ = h.db.Exec(context.Background(),
    `update tasks set status='done', plan_id=$2, finished_at=$3 where id=$1`,
    taskID, planID, time.Now(),
  )

  c.JSON(http.StatusAccepted, gin.H{"task_id": taskID.String()})
}