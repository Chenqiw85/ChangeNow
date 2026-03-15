"""Abstract base class that every LLM provider must implement."""

from abc import ABC, abstractmethod
from app.llm.models import LLMRequest, LLMResponse


class BaseLLMProvider(ABC):
    """Interface contract for LLM providers (OpenAI, Anthropic, etc.)."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique provider identifier, e.g. 'openai', 'anthropic'."""
        ...

    @abstractmethod
    async def generate(self, request: LLMRequest) -> LLMResponse:
        """
        Send a prompt to the LLM and return a unified response.
        Raises ProviderError on failure.
        """
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if this provider is configured (API key present)."""
        ...