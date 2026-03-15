"""
Prompt Manager - loads versioned YAML prompt templates and renders them.

Templates live in app/prompts/templates/{version}/{name}.yaml
Each template has 'system' and 'user' fields with {variable} placeholders.
"""

import logging
from pathlib import Path
from functools import lru_cache

import yaml

from app.config import get_settings

logger = logging.getLogger(__name__)


class PromptTemplate:
    """A loaded prompt template with version info."""

    def __init__(self, version: str, name: str, system: str, user: str):
        self.version = version
        self.name = name
        self._system = system
        self._user = user

    def render(self, **kwargs) -> tuple[str, str]:
        """
        Render the template with the given variables.

        Returns:
            (system_prompt, user_prompt) tuple with variables substituted.
        """
        try:
            system = self._system.format(**kwargs)
            user = self._user.format(**kwargs)
            return system, user
        except KeyError as e:
            raise ValueError(f"Missing template variable: {e}")


class PromptManager:
    """Loads and caches prompt templates from the filesystem."""

    def __init__(self):
        settings = get_settings()
        self._base_dir = Path(settings.prompt_dir)

    @lru_cache(maxsize=64)
    def get_template(self, name: str, version: str = "v1") -> PromptTemplate:
        """
        Load a prompt template by name and version.

        Args:
            name: Template name (e.g. 'fitness_plan')
            version: Version string (e.g. 'v1', 'v2')

        Returns:
            PromptTemplate ready to render.
        """
        path = self._base_dir / version / f"{name}.yaml"
        if not path.exists():
            raise FileNotFoundError(f"Prompt template not found: {path}")

        with open(path) as f:
            data = yaml.safe_load(f)

        logger.info(f"Loaded prompt template: {name} ({version})")

        return PromptTemplate(
            version=data.get("version", version),
            name=data.get("name", name),
            system=data.get("system", ""),
            user=data.get("user", ""),
        )

    def list_versions(self, name: str) -> list[str]:
        """List available versions for a given template name."""
        versions = []
        if self._base_dir.exists():
            for d in sorted(self._base_dir.iterdir()):
                if d.is_dir() and (d / f"{name}.yaml").exists():
                    versions.append(d.name)
        return versions


# Singleton
_manager: PromptManager | None = None


def get_prompt_manager() -> PromptManager:
    global _manager
    if _manager is None:
        _manager = PromptManager()
    return _manager