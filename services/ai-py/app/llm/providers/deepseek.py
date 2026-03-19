"""DeepSeek provider implementation (OpenAI-compatible API)."""

import time
import logging
from openai import AsyncOpenAI

from app.config import get_settings
from app.llm.models import LLMRequest, LLMResponse, ProviderError
from app.llm.providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)


class DeepSeekProvider(BaseLLMProvider):
    """DeepSeek provider (uses OpenAI-compatible endpoint)."""

    def __init__(self):
        settings = get_settings()
        self._api_key = settings.deepseek_api_key
        self._model = settings.deepseek_model
        if self._api_key:
            self._client = AsyncOpenAI(
                api_key=self._api_key,
                base_url="https://api.deepseek.com",  # DeepSeek 的 endpoint
            )
        else:
            self._client = None

    @property
    def name(self) -> str:
        return "deepseek"

    def is_available(self) -> bool:
        return bool(self._api_key)

    async def generate(self, request: LLMRequest) -> LLMResponse:
        if not self.is_available():
            raise ProviderError(self.name, "API key not configured")

        try:
            start = time.monotonic()

            messages = []
            if request.system_prompt:
                messages.append({"role": "system", "content": request.system_prompt})
            messages.append({"role": "user", "content": request.user_prompt})

            response = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )

            latency = (time.monotonic() - start) * 1000
            usage = response.usage

            logger.info(
                "DeepSeek request completed",
                extra={
                    "model": self._model,
                    "latency_ms": round(latency, 1),
                    "tokens": usage.total_tokens if usage else 0,
                },
            )

            return LLMResponse(
                content=response.choices[0].message.content or "",
                provider=self.name,
                model=self._model,
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
                latency_ms=round(latency, 1),
            )

        except Exception as e:
            logger.error(f"DeepSeek request failed: {e}")
            raise ProviderError(self.name, str(e))