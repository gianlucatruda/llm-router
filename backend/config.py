"""Configuration management for LLM Router."""

from typing import Any

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    openai_api_key: str
    anthropic_api_key: str = ""  # Optional for v0
    database_path: str = "./data/llm-router.db"

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
    }


# Model configurations with pricing ($/1K tokens)
MODELS: dict[str, dict[str, Any]] = {
    "openai": {
        "gpt-4o": {
            "name": "GPT-4o",
            "input_cost": 0.0025,
            "output_cost": 0.01,
        },
        "gpt-4-turbo": {
            "name": "GPT-4 Turbo",
            "input_cost": 0.01,
            "output_cost": 0.03,
        },
        "gpt-3.5-turbo": {
            "name": "GPT-3.5 Turbo",
            "input_cost": 0.0005,
            "output_cost": 0.0015,
        },
    }
}


def get_model_config(model: str) -> dict[str, Any]:
    """Get configuration for a specific model."""
    for provider_models in MODELS.values():
        if model in provider_models:
            return provider_models[model]
    raise ValueError(f"Unknown model: {model}")


def get_provider(model: str) -> str:
    """Get provider name for a model."""
    for provider, models in MODELS.items():
        if model in models:
            return provider
    raise ValueError(f"Unknown model: {model}")


settings = Settings()
