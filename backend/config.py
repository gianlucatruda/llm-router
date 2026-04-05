"""Configuration management for LLM Router."""

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    openai_api_key: str = ""
    anthropic_api_key: str = ""  # Optional for v0
    database_path: str = "./data/llm-router.db"

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
    }


APP_VERSION = "0.2.1"
APP_GIT_REF = os.getenv("APP_GIT_REF", "dev")
APP_REPO = os.getenv("APP_REPO", "gianlucatruda/llm-router")
APP_COMMIT_FILE = os.getenv("APP_COMMIT_FILE", "/app/.git-sha")

_GIT_SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")

DEFAULT_MODEL = "gpt-5.1"
DEFAULT_REASONING = "low"
DEFAULT_TEMPERATURE = 0.2

# Model configurations with pricing ($/1K tokens)
FALLBACK_MODELS: dict[str, dict[str, Any]] = {
    "openai": {
        "gpt-5.1": {
            "name": "GPT-5.1",
            "input_cost": 0.01,
            "output_cost": 0.03,
            "supports_reasoning": True,
            "reasoning_levels": ["low", "medium", "high"],
            "supports_temperature": False,
        },
        "gpt-5.2": {
            "name": "GPT-5.2",
            "input_cost": 0.012,
            "output_cost": 0.036,
            "supports_reasoning": True,
            "reasoning_levels": ["low", "medium", "high"],
            "supports_temperature": False,
        },
        "o1": {
            "name": "o1",
            "input_cost": 0.015,
            "output_cost": 0.06,
            "supports_reasoning": True,
            "reasoning_levels": ["low", "medium", "high"],
            "supports_temperature": False,
        },
        "o1-mini": {
            "name": "o1 mini",
            "input_cost": 0,
            "output_cost": 0,
            "supports_reasoning": True,
            "reasoning_levels": ["low", "medium", "high"],
            "supports_temperature": False,
        },
        "o1-preview": {
            "name": "o1 preview",
            "input_cost": 0,
            "output_cost": 0,
            "supports_reasoning": True,
            "reasoning_levels": ["low", "medium", "high"],
            "supports_temperature": False,
        },
        "o3": {
            "name": "o3",
            "input_cost": 0.02,
            "output_cost": 0.08,
            "supports_reasoning": True,
            "reasoning_levels": ["low", "medium", "high"],
            "supports_temperature": False,
        },
        "o3-mini": {
            "name": "o3 mini",
            "input_cost": 0,
            "output_cost": 0,
            "supports_reasoning": True,
            "reasoning_levels": ["low", "medium", "high"],
            "supports_temperature": False,
        },
        "gpt-4o": {
            "name": "GPT-4o",
            "input_cost": 0.0025,
            "output_cost": 0.01,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
        "gpt-4-turbo": {
            "name": "GPT-4 Turbo",
            "input_cost": 0.01,
            "output_cost": 0.03,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
        "gpt-3.5-turbo": {
            "name": "GPT-3.5 Turbo",
            "input_cost": 0.0005,
            "output_cost": 0.0015,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
    },
    "anthropic": {
        "claude-3-opus-20240229": {
            "name": "Claude 3 Opus",
            "input_cost": 0.015,
            "output_cost": 0.075,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
        "claude-3-5-sonnet-20240620": {
            "name": "Claude 3.5 Sonnet",
            "input_cost": 0.003,
            "output_cost": 0.015,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
        "claude-3-5-haiku-20240620": {
            "name": "Claude 3.5 Haiku",
            "input_cost": 0,
            "output_cost": 0,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
        "claude-3-5-sonnet-20241022": {
            "name": "Claude 3.5 Sonnet (2024-10-22)",
            "input_cost": 0.003,
            "output_cost": 0.015,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
        "claude-3-5-haiku-20241022": {
            "name": "Claude 3.5 Haiku (2024-10-22)",
            "input_cost": 0,
            "output_cost": 0,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
        "claude-3-sonnet-20240229": {
            "name": "Claude 3 Sonnet",
            "input_cost": 0.003,
            "output_cost": 0.015,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
        "claude-3-haiku-20240307": {
            "name": "Claude 3 Haiku",
            "input_cost": 0.00025,
            "output_cost": 0.00125,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
        "claude-sonnet-4-5": {
            "name": "Claude Sonnet 4.5",
            "input_cost": 0.006,
            "output_cost": 0.03,
            "supports_reasoning": False,
            "reasoning_levels": [],
            "supports_temperature": True,
        },
    },
}


def get_model_config(model: str) -> dict[str, Any]:
    """Get configuration for a specific model."""
    for provider_models in FALLBACK_MODELS.values():
        if model in provider_models:
            return provider_models[model]
    return {
        "name": model,
        "input_cost": 0,
        "output_cost": 0,
        "supports_reasoning": False,
        "reasoning_levels": [],
        "supports_temperature": True,
    }


def get_provider(model: str) -> str:
    """Get provider name for a model."""
    for provider, models in FALLBACK_MODELS.items():
        if model in models:
            return provider
    if model.startswith("claude"):
        return "anthropic"
    if model.startswith("gpt-") or (
        model.startswith("o") and len(model) > 1 and model[1].isdigit()
    ):
        return "openai"
    raise ValueError(f"Unknown model: {model}")


settings = Settings()


def _normalize_sha(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    if not _GIT_SHA_RE.fullmatch(value):
        return None
    return value.lower()


def _read_commit_file(path: str) -> str | None:
    try:
        return _normalize_sha(Path(path).read_text().strip())
    except (FileNotFoundError, OSError):
        return None


def _resolve_github_ref(repo: str, ref: str) -> str | None:
    if not repo or not ref:
        return None
    url = f"https://api.github.com/repos/{repo}/commits/{ref}"
    request = Request(url, headers={"User-Agent": "llm-router"})
    try:
        with urlopen(request, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return _normalize_sha(payload.get("sha"))
    except (URLError, ValueError, OSError):
        return None


@lru_cache(maxsize=1)
def get_commit_info() -> tuple[str | None, str]:
    for key in ("GIT_SHA", "GIT_COMMIT", "VCS_REF", "SOURCE_COMMIT", "REVISION"):
        sha = _normalize_sha(os.getenv(key))
        if sha:
            return sha, sha[:7]
    sha = _read_commit_file(APP_COMMIT_FILE)
    if sha:
        return sha, sha[:7]
    ref = os.getenv("GIT_REF") or os.getenv("SOURCE_REF") or APP_GIT_REF
    sha = _resolve_github_ref(APP_REPO, ref)
    if sha:
        return sha, sha[:7]
    return None, "dev"
