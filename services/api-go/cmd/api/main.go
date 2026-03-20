package main

import (
	"log"
	"os"

	"context"

	http2 "net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"go.uber.org/zap"

	"changenow/api-go/internal/ai"
	"changenow/api-go/internal/cache"
	"changenow/api-go/internal/http"
	"changenow/api-go/internal/logger"
)

func main()  {
	_ = godotenv.Load();

	// ── Logger ──────────────────────────────────────
	logger.Init()
	defer logger.Sync()

	//Database
	dbURL := os.Getenv("DATABASE_URL")

	if dbURL == "" {
		log.Fatal("DATABASE_URL is empty")
	}

	pool, err := pgxpool.New(context.TODO(),dbURL)
	if err!= nil{
		log.Fatal(err)
	}
	defer pool.Close()

	// ── Redis ───────────────────────────────────────
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	redisClient, err := cache.NewRedisClient(redisURL)
	if err != nil {
		logger.Log.Warn("Redis not available, caching and rate limiting disabled",
			zap.Error(err))
	} else {
		defer redisClient.Close()
		logger.Log.Info("Redis connected")
	}

	// ── Asynq Client (task producer) ────────────────
	redisOpt, err := asynq.ParseRedisURI(redisURL)
	if err != nil {
		log.Fatalf("invalid REDIS_URL for Asynq: %v", err)
	}
	queueClient := asynq.NewClient(redisOpt)
	defer queueClient.Close()
	logger.Log.Info("Asynq client connected")

	// ── AI Service Client ───────────────────────────
	aiURL := os.Getenv("AI_SERVICE_URL")
	if aiURL == "" {
		aiURL = "http://localhost:8001"
	}
	aiClient := ai.NewClient(aiURL)

	if err := aiClient.Health(context.Background()); err != nil {
		logger.Log.Warn("AI service not reachable", zap.Error(err))
	} else {
		logger.Log.Info("AI service connected")
	}

	// ── Router ──────────────────────────────────────
	gin.SetMode(gin.ReleaseMode) // disable Gin's default logger
	r := gin.New()               // gin.New() instead of gin.Default() — no default middleware
	r.Use(gin.Recovery())        // keep panic recovery

	http.RegisterRoutes(r, pool, aiClient, redisClient, queueClient)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	logger.Log.Info("API starting", zap.String("port", port))
	// ── Graceful Shutdown ───────────────────────────
	srv := &http2.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Start server in a goroutine
	go func() {
		logger.Log.Info("API starting", zap.String("port", port))
		if err := srv.ListenAndServe(); err != nil && err != http2.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	logger.Log.Info("shutdown signal received", zap.String("signal", sig.String()))

	// Give outstanding requests 30 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Log.Error("forced shutdown", zap.Error(err))
	}

	logger.Log.Info("server stopped gracefully")
}
