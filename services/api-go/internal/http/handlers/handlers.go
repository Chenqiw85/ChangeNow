package handlers

import (
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"changenow/api-go/internal/ai"
	"changenow/api-go/internal/cache"
)

type Handlers struct {
  db *pgxpool.Pool
  aiClient *ai.Client 
  cache    *cache.RedisClient
  queue    *asynq.Client
}

func New(db *pgxpool.Pool, aiClient *ai.Client, cache *cache.RedisClient, queue *asynq.Client) *Handlers {
	return &Handlers{db: db, aiClient: aiClient, cache: cache, queue: queue}
}