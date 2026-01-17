"""Configuration management for LLM Router."""

from typing import Any

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
            "supports_temperature": True,
        },
        "gpt-5.2": {
            "name": "GPT-5.2",
            "input_cost": 0.012,
            "output_cost": 0.036,
            "supports_reasoning": True,
            "reasoning_levels": ["low", "medium", "high"],
            "supports_temperature": True,
        },
        "o1": {
            "name": "o1",
            "input_cost": 0.015,
            "output_cost": 0.06,
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
        "claude-3-5-sonnet-20241022": {
            "name": "Claude 3.5 Sonnet (2024-10-22)",
            "input_cost": 0.003,
            "output_cost": 0.015,
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
    if model.startswith(("gpt-", "o1", "o3")):
        return "openai"
    raise ValueError(f"Unknown model: {model}")


settings = Settings()
