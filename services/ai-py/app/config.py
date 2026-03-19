"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API Keys
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    deepseek_api_key: str = ""

    # Provider priority (comma-separated)
    llm_provider_priority: str = "openai,anthropic"

    # Model defaults
    openai_model: str = "gpt-4o"
    anthropic_model: str = "claude-sonnet-4-20250514"
    deepseek_model: str = "deepseek-chat"

    # Service
    ai_service_port: int = 8001
    log_level: str = "INFO"

    # Prompt config
    prompt_dir: str = "app/prompts"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def provider_chain(self) -> list[str]:
        """Return ordered list of provider names for fallback chain."""
        return [p.strip() for p in self.llm_provider_priority.split(",")]


@lru_cache()
def get_settings() -> Settings:
    return Settings()