package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// ── HTTP Metrics ────────────────────────────────────────

// RequestsTotal counts total HTTP requests, labeled by method, path, and status.
var RequestsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total number of HTTP requests",
	},
	[]string{"method", "path", "status"},
)

// RequestDuration tracks HTTP request latency in seconds.
var RequestDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request duration in seconds",
		Buckets: []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120},
	},
	[]string{"method", "path"},
)

// ── LLM Metrics ─────────────────────────────────────────

// LLMRequestsTotal counts LLM API calls, labeled by provider and status.
var LLMRequestsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "llm_requests_total",
		Help: "Total number of LLM API calls",
	},
	[]string{"provider", "status"},
)

// LLMTokensTotal tracks total tokens consumed, labeled by provider.
var LLMTokensTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "llm_tokens_total",
		Help: "Total tokens consumed across LLM calls",
	},
	[]string{"provider"},
)

// LLMLatency tracks LLM call latency in seconds.
var LLMLatency = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name:    "llm_request_duration_seconds",
		Help:    "LLM API call duration in seconds",
		Buckets: []float64{0.5, 1, 2, 5, 10, 30, 60},
	},
	[]string{"provider"},
)

// LLMFallbackTotal counts how many times fallback was triggered.
var LLMFallbackTotal = promauto.NewCounter(
	prometheus.CounterOpts{
		Name: "llm_fallback_total",
		Help: "Total number of times LLM provider fallback was triggered",
	},
)

// ── Cache Metrics ───────────────────────────────────────

// CacheHits counts cache hits vs misses.
var CacheHits = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "cache_operations_total",
		Help: "Cache hit/miss counts",
	},
	[]string{"result"}, // "hit" or "miss"
)

// ── Rate Limit Metrics ──────────────────────────────────

// RateLimitHits counts how many requests were rate limited.
var RateLimitHits = promauto.NewCounter(
	prometheus.CounterOpts{
		Name: "ratelimit_rejected_total",
		Help: "Total number of requests rejected by rate limiter",
	},
)