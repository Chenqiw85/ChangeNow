"""
LLM Gateway - the core routing layer.

Accepts a unified LLMRequest, tries providers in priority order,
and automatically falls back to the next provider on failure.

Architecture:
  Request → Gateway → [OpenAI] → success → Response
                          ↓ fail
                      [Anthropic] → success → Response
                          ↓ fail
                      AllProvidersFailedError
"""

import logging
from app.config import get_settings
from app.llm.models import (
    LLMRequest,
    LLMResponse,
    ProviderError,
    AllProvidersFailedError,
)
from app.llm.providers.base import BaseLLMProvider
from app.llm.providers.openai import OpenAIProvider
from app.llm.providers.anthropic import AnthropicProvider

logger = logging.getLogger(__name__)

# Registry: maps provider name → class
_PROVIDER_REGISTRY: dict[str, type[BaseLLMProvider]] = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
}


class LLMGateway:
    """
    Routes LLM requests through a prioritized provider chain with fallback.

    Usage:
        gateway = LLMGateway()
        response = await gateway.generate(LLMRequest(user_prompt="..."))
    """

    def __init__(self):
        settings = get_settings()
        self._providers: list[BaseLLMProvider] = []

        for name in settings.provider_chain:
            cls = _PROVIDER_REGISTRY.get(name)
            if cls is None:
                logger.warning(f"Unknown provider '{name}' in priority chain, skipping")
                continue
            provider = cls()
            if provider.is_available():
                self._providers.append(provider)
                logger.info(f"Provider '{name}' registered and available")
            else:
                logger.warning(f"Provider '{name}' skipped (no API key)")

        if not self._providers:
            logger.error("No LLM providers available! Check your API keys.")

    @property
    def available_providers(self) -> list[str]:
        """Return names of providers that are configured and ready."""
        return [p.name for p in self._providers]

    async def generate(
        self,
        request: LLMRequest,
        preferred_provider: str | None = None,
    ) -> LLMResponse:
        """
        Send request through the provider chain.

        Args:
            request: The unified LLM request.
            preferred_provider: If set, try this provider first (then fall back).

        Returns:
            LLMResponse from the first provider that succeeds.

        Raises:
            AllProvidersFailedError if every provider fails.
        """
        # Build the execution order
        chain = list(self._providers)
        if preferred_provider:
            # Move preferred provider to front
            chain.sort(key=lambda p: 0 if p.name == preferred_provider else 1)

        errors: list[ProviderError] = []

        for provider in chain:
            try:
                logger.info(f"Attempting provider: {provider.name}")
                response = await provider.generate(request)
                if errors:
                    # Log that we fell back
                    failed_names = [e.provider for e in errors]
                    logger.warning(
                        f"Fallback success: {failed_names} failed, "
                        f"{provider.name} succeeded"
                    )
                return response

            except ProviderError as e:
                logger.warning(f"Provider {provider.name} failed: {e.message}")
                errors.append(e)
                continue

        raise AllProvidersFailedError(errors)


# Singleton instance
_gateway_instance: LLMGateway | None = None


def get_gateway() -> LLMGateway:
    """Get or create the singleton LLM Gateway instance."""
    global _gateway_instance
    if _gateway_instance is None:
        _gateway_instance = LLMGateway()
    return _gateway_instance