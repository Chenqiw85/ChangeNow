package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GenerateRequest is the payload sent to the Python AI service.
// Field names match the Python FastAPI schema (GeneratePlanRequest).
type GenerateRequest struct {
	Goal              string `json:"goal"`
	DaysPerWeek       int    `json:"days_per_week"`
	Equipment         string `json:"equipment"`
	Constraints       string `json:"constraints"`
	PromptVersion     string `json:"prompt_version"`
	PreferredProvider string `json:"preferred_provider,omitempty"`
}

// GenerateResponse is the payload returned from the Python AI service.
// Field names match the Python FastAPI schema (GeneratePlanResponse).
type GenerateResponse struct {
	PlanText      string  `json:"plan_text"`
	Provider      string  `json:"provider"`
	Model         string  `json:"model"`
	PromptVersion string  `json:"prompt_version"`
	TotalTokens   int     `json:"total_tokens"`
	LatencyMs     float64 `json:"latency_ms"`
}

// Client talks to the Python AI microservice.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates an AI service client.
// baseURL is like "http://localhost:8001"
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // LLM calls can be slow
		},
	}
}

// Generate calls the Python AI service to produce a fitness plan.
func (c *Client) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	// 1. Serialize request to JSON
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	// 2. Build HTTP request
	url := c.baseURL + "/v1/generate"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	// 3. Send request
	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request to AI service: %w", err)
	}
	defer httpResp.Body.Close()

	// 4. Read response body
	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	// 5. Check HTTP status
	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service returned %d: %s", httpResp.StatusCode, string(respBody))
	}

	// 6. Deserialize response
	var resp GenerateResponse
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &resp, nil
}

// Health checks if the Python AI service is running.
func (c *Client) Health(ctx context.Context) error {
	url := c.baseURL + "/v1/health"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("create health request: %w", err)
	}

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("AI service unreachable: %w", err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		return fmt.Errorf("AI service unhealthy: status %d", httpResp.StatusCode)
	}

	return nil
}