"""Shared schemas for LLM requests and responses."""

from pydantic import BaseModel, Field


class LLMRequest(BaseModel):
    """Unified request format sent to any LLM provider."""
    system_prompt: str = ""
    user_prompt: str
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2048, ge=1, le=16384)


class LLMResponse(BaseModel):
    """Unified response format returned from any LLM provider."""
    content: str
    provider: str          # which provider actually served this request
    model: str             # which model was used
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0


class ProviderError(Exception):
    """Raised when a single provider fails."""
    def __init__(self, provider: str, message: str):
        self.provider = provider
        self.message = message
        super().__init__(f"[{provider}] {message}")


class AllProvidersFailedError(Exception):
    """Raised when every provider in the fallback chain fails."""
    def __init__(self, errors: list[ProviderError]):
        self.errors = errors
        details = "; ".join(f"{e.provider}: {e.message}" for e in errors)
        super().__init__(f"All providers failed: {details}")