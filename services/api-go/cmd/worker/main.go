package main

import (
	"context"
	"log"
	"os"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"changenow/api-go/internal/ai"
	"changenow/api-go/internal/cache"
	"changenow/api-go/internal/logger"
	"changenow/api-go/internal/worker"
)

func main() {
	_ = godotenv.Load()

	// ── Logger ──────────────────────────────────────
	logger.Init()
	defer logger.Sync()

	// ── Database ────────────────────────────────────
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is empty")
	}

	pool, err := pgxpool.New(context.TODO(), dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	// ── AI Client ───────────────────────────────────
	aiURL := os.Getenv("AI_SERVICE_URL")
	if aiURL == "" {
		aiURL = "http://localhost:8001"
	}
	aiClient := ai.NewClient(aiURL)

	// ── Asynq Worker ────────────────────────────────
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	redisOpt, err := asynq.ParseRedisURI(redisURL)
	if err != nil {
		log.Fatalf("invalid REDIS_URL: %v", err)
	}

	rc, err := cache.NewRedisClient(redisURL)
	if err != nil {
		log.Fatalf("redis for worker cache: %v", err)
	}
	defer rc.Close()

	srv := asynq.NewServer(redisOpt, asynq.Config{
		Concurrency: 5, // process up to 5 tasks simultaneously
		Queues: map[string]int{
			"default": 10, // priority weight
		},
	})

	// Register task handlers
	mux := asynq.NewServeMux()
	planHandler := worker.NewPlanHandler(pool, aiClient, rc)
	mux.HandleFunc(worker.TypePlanGenerate, planHandler.HandlePlanGenerate)

	logger.Log.Info("Worker starting, waiting for tasks...")

	if err := srv.Run(mux); err != nil {
		log.Fatalf("worker failed: %v", err)
	}
}
