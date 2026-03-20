package http

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"changenow/api-go/internal/ai"
	"changenow/api-go/internal/cache"
	"changenow/api-go/internal/http/handlers"
	"changenow/api-go/internal/http/middleware"
)

func RegisterRoutes(r *gin.Engine, db *pgxpool.Pool, aiClient *ai.Client, redisClient *cache.RedisClient, queue *asynq.Client){
  h := handlers.New(db,aiClient,redisClient, queue)


  r.GET("/metrics", gin.WrapH(promhttp.Handler()))

  // Global middleware — applies to ALL routes
	r.Use(middleware.RequestID())
  r.Use(middleware.Metrics())
	r.Use(middleware.Logging())

  v1 := r.Group("/v1")
  {
    v1.POST("/auth/register", h.Register)
    v1.POST("/auth/login", h.Login)

    auth := v1.Group("/")
    auth.Use(middleware.AuthRequired())
    auth.Use(middleware.RateLimiter(redisClient, 10, 1*time.Minute))
    {
      auth.POST("/plans/generate", h.GeneratePlan)
      auth.GET("/tasks/:id", h.GetTask)
      auth.GET("/plans/:id", h.GetPlan)

      //Exercise
      auth.GET("/exercises", h.ListExercises)
			auth.POST("/exercises", h.CreateExercise)
			auth.DELETE("/exercises/:id", h.DeleteExercise)

			// Workouts
			auth.POST("/workouts", h.LogWorkout)
      auth.DELETE("/workouts/:id",h.DeleteSet)
			auth.GET("/exercises/:id/history", h.GetExerciseHistory)
      auth.GET("/exercises/history",h.GetDailyExercisesHistory)
      auth.GET("/exercises/:id/details",h.GetDailyExercisesDetails)
    }
  }
}