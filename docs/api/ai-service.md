# Python AI Service

The AI service is a FastAPI app in `services/ai-py`. It is called by the Go worker, not directly by the frontend.

Local default URL: `http://localhost:8001`.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | empty | Enables OpenAI provider. |
| `ANTHROPIC_API_KEY` | empty | Enables Anthropic provider. |
| `DEEPSEEK_API_KEY` | empty | Enables DeepSeek provider. |
| `LLM_PROVIDER_PRIORITY` | `openai,anthropic` | Ordered fallback chain. |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model. |
| `DEEPSEEK_MODEL` | `deepseek-chat` | DeepSeek model. |
| `AI_SERVICE_PORT` | `8001` | Intended service port. Docker command currently binds Uvicorn to 8001. |
| `LOG_LEVEL` | `INFO` | Python logging level. |
| `PROMPT_DIR` | `app/prompts` | Prompt template root. |

At least one provider API key is required for successful generation.

## Endpoints

### `GET /v1/health`

Returns service status and configured providers.

Response:

```json
{
  "status": "ok",
  "providers": ["openai", "anthropic"]
}
```

### `POST /v1/generate`

Renders a versioned prompt template and sends one LLM request through the gateway.

Request:

```json
{
  "goal": "Build muscle and lose fat",
  "days_per_week": 4,
  "equipment": "full gym",
  "constraints": "none",
  "prompt_version": "v1",
  "preferred_provider": "openai"
}
```

Response:

```json
{
  "plan_text": "{\"plan_name\":\"...\"}",
  "provider": "openai",
  "model": "gpt-4o",
  "prompt_version": "v1",
  "total_tokens": 1234,
  "latency_ms": 2450.3
}
```

Errors:

- `400` prompt version not found.
- `502` all providers failed.

### `POST /v1/generate/agent`

Runs the LangGraph workflow:

```text
planner -> reviewer -> reviser loop when needed -> formatter
```

Request shape is the same as `/v1/generate`.

Response shape is the same as `/v1/generate`.

Current behavior:

- `preferred_provider` is not passed into agent node gateway calls.
- `latency_ms` is returned as `0`.
- Formatter attempts to extract valid JSON; if it cannot, it returns the draft and an internal warning field in workflow state, but the HTTP response still uses `plan_text`.

### `POST /v1/llm/raw`

Debug endpoint that bypasses prompt templates.

Request:

```json
{
  "system_prompt": "You are concise.",
  "user_prompt": "Say hello.",
  "temperature": 0.7,
  "max_tokens": 2048,
  "preferred_provider": "anthropic"
}
```

Response:

```json
{
  "content": "Hello.",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "tokens": 42,
  "latency_ms": 510.2
}
```

Errors:

- `502` all providers failed.

## LLM Gateway

`app/llm/gateway.py` builds a provider chain from `LLM_PROVIDER_PRIORITY`. Unknown provider names are skipped. Providers without API keys are skipped.

Generation behavior:

1. Build chain from available providers.
2. If `preferred_provider` is supplied, sort that provider to the front.
3. Try each provider until one succeeds.
4. Raise `AllProvidersFailedError` if every provider fails.

Registered providers:

- `openai`
- `anthropic`
- `deepseek`

## Prompt Templates

The current prompt template is:

```text
services/ai-py/app/prompts/v1/fitness_plan.yaml
```

It defines:

- `version`
- `name`
- `description`
- `system`
- `user`

The plain generation endpoint renders the template with:

- `goal`
- `days_per_week`
- `equipment`
- `constraints`

There is no implemented prompt-list HTTP route in the current code, even though the service docstring mentions one.

## Request IDs

The AI service middleware reads `X-Request-ID` or generates a UUID, logs request start metadata, and echoes `X-Request-ID` in the response. The Go worker forwards the Go API request ID when calling the AI service.

