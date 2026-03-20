package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"

	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

// NewRedisClient creates a Redis client from a URL like "redis://localhost:6379/0"
func NewRedisClient(redisURL string) (*RedisClient, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	return &RedisClient{client: client}, nil
}

// Close shuts down the Redis connection.
func (r *RedisClient) Close() error {
	return r.client.Close()
}

// ── Plan Cache ──────────────────────────────────────────

// PlanCacheKey generates a deterministic cache key from plan parameters.
// Same inputs always produce the same key.
func PlanCacheKey(userID int64, goal string, daysPerWeek int, equipment, constraints, promptVersion string) string {
	raw := fmt.Sprintf("plan:%d:%s:%d:%s:%s:%s", userID, goal, daysPerWeek, equipment, constraints, promptVersion)
	hash := sha256.Sum256([]byte(raw))
	return "plan_cache:" + hex.EncodeToString(hash[:16]) // first 16 bytes = 32 hex chars
}

// GetCachedPlan retrieves a cached plan. Returns nil if not found.
func (r *RedisClient) GetCachedPlan(ctx context.Context, key string) ([]byte, error) {
	val, err := r.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil // cache miss, not an error
	}
	if err != nil {
		return nil, fmt.Errorf("redis get: %w", err)
	}
	return val, nil
}

// SetCachedPlan stores a plan in cache with a TTL.
func (r *RedisClient) SetCachedPlan(ctx context.Context, key string, data []byte, ttl time.Duration) error {
	return r.client.Set(ctx, key, data, ttl).Err()
}

// ── Rate Limiting ───────────────────────────────────────

// RateLimitResult holds the result of a rate limit check.
type RateLimitResult struct {
	Allowed   bool
	Remaining int64
	ResetAt   time.Time
}

// CheckRateLimit implements a sliding window rate limiter.
// key: unique identifier (e.g. "ratelimit:user:42")
// limit: max requests allowed in the window
// window: time window duration
func (r *RedisClient) CheckRateLimit(ctx context.Context, key string, limit int64, window time.Duration) (*RateLimitResult, error) {
	now := time.Now()
	windowStart := now.Add(-window)

	// Use a Redis pipeline for atomicity
	pipe := r.client.Pipeline()

	// 1. Remove entries outside the window
	pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart.UnixMicro()))

	// 2. Count current entries in the window
	countCmd := pipe.ZCard(ctx, key)

	// 3. Execute pipeline
	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("rate limit check: %w", err)
	}

	currentCount := countCmd.Val()

	if currentCount >= limit {
		// Over limit — find when the oldest entry expires
		oldest, err := r.client.ZRangeWithScores(ctx, key, 0, 0).Result()
		if err != nil || len(oldest) == 0 {
			return &RateLimitResult{Allowed: false, Remaining: 0, ResetAt: now.Add(window)}, nil
		}
		oldestTime := time.UnixMicro(int64(oldest[0].Score))
		resetAt := oldestTime.Add(window)

		return &RateLimitResult{
			Allowed:   false,
			Remaining: 0,
			ResetAt:   resetAt,
		}, nil
	}

	// Under limit — add this request
	member := redis.Z{Score: float64(now.UnixMicro()), Member: now.UnixMicro()}
	r.client.ZAdd(ctx, key, member)
	r.client.Expire(ctx, key, window+time.Second) // auto-cleanup

	return &RateLimitResult{
		Allowed:   true,
		Remaining: limit - currentCount - 1,
		ResetAt:   now.Add(window),
	}, nil
}