"""Anthropic Claude provider implementation."""

import time
import logging
from anthropic import AsyncAnthropic

from app.config import get_settings
from app.llm.models import LLMRequest, LLMResponse, ProviderError
from app.llm.providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider."""

    def __init__(self):
        settings = get_settings()
        self._api_key = settings.anthropic_api_key
        self._model = settings.anthropic_model
        if self._api_key:
            self._client = AsyncAnthropic(api_key=self._api_key)
        else:
            self._client = None

    @property
    def name(self) -> str:
        return "anthropic"

    def is_available(self) -> bool:
        return bool(self._api_key)

    async def generate(self, request: LLMRequest) -> LLMResponse:
        if not self.is_available():
            raise ProviderError(self.name, "API key not configured")

        try:
            start = time.monotonic()

            # Anthropic uses a separate 'system' parameter
            kwargs = {
                "model": self._model,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
                "messages": [{"role": "user", "content": request.user_prompt}],
            }
            if request.system_prompt:
                kwargs["system"] = request.system_prompt

            response = await self._client.messages.create(**kwargs)

            latency = (time.monotonic() - start) * 1000

            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text

            logger.info(
                "Anthropic request completed",
                extra={
                    "model": self._model,
                    "latency_ms": round(latency, 1),
                    "tokens": response.usage.input_tokens + response.usage.output_tokens,
                },
            )

            return LLMResponse(
                content=content,
                provider=self.name,
                model=self._model,
                prompt_tokens=response.usage.input_tokens,
                completion_tokens=response.usage.output_tokens,
                total_tokens=response.usage.input_tokens + response.usage.output_tokens,
                latency_ms=round(latency, 1),
            )

        except Exception as e:
            logger.error(f"Anthropic request failed: {e}")
            raise ProviderError(self.name, str(e))