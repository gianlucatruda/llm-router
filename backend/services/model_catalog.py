"""Model catalog builder with live fetch + fallback metadata."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import httpx

from config import DEFAULT_MODEL, DEFAULT_REASONING, DEFAULT_TEMPERATURE, FALLBACK_MODELS
from models import ModelCatalog, ModelDefaults, ModelInfo
from services.llm_client import llm_client

OPENAI_PREFIXES = ("gpt-", "o1", "o3")
ANTHROPIC_PREFIXES = ("claude",)


def _matches_prefix(model_id: str, prefixes: Iterable[str]) -> bool:
    return any(model_id.startswith(prefix) for prefix in prefixes)


def _merge_models(
    provider: str, live_models: list[str] | None, fallback: dict[str, dict]
) -> list[ModelInfo]:
    models: list[ModelInfo] = []
    live_set = set(live_models or [])
    if live_models:
        for model_id in sorted(live_set):
            if provider == "openai" and not _matches_prefix(model_id, OPENAI_PREFIXES):
                continue
            if provider == "anthropic" and not _matches_prefix(model_id, ANTHROPIC_PREFIXES):
                continue
            fallback_meta = fallback.get(model_id, {})
            inferred = _infer_capabilities(provider, model_id)
            models.append(
                ModelInfo(
                    id=model_id,
                    name=fallback_meta.get("name", model_id),
                    provider=provider,
                    input_cost=fallback_meta.get("input_cost", 0),
                    output_cost=fallback_meta.get("output_cost", 0),
                    source="live",
                    pricing_source="fallback" if model_id in fallback else "unknown",
                    supports_reasoning=fallback_meta.get(
                        "supports_reasoning", inferred["supports_reasoning"]
                    ),
                    reasoning_levels=fallback_meta.get("reasoning_levels", inferred["reasoning_levels"]),
                    supports_temperature=fallback_meta.get(
                        "supports_temperature", inferred["supports_temperature"]
                    ),
                )
            )
    for model_id, meta in fallback.items():
        if model_id in live_set:
            continue
        models.append(
            ModelInfo(
                id=model_id,
                name=meta["name"],
                provider=provider,
                input_cost=meta["input_cost"],
                output_cost=meta["output_cost"],
                source="fallback",
                pricing_source="fallback",
                supports_reasoning=meta.get("supports_reasoning", False),
                reasoning_levels=meta.get("reasoning_levels", []),
                supports_temperature=meta.get("supports_temperature", True),
            )
        )
    return models


def _infer_capabilities(provider: str, model_id: str) -> dict[str, Any]:
    if provider == "openai":
        if model_id.startswith(("o1", "o3", "gpt-5")):
            return {
                "supports_reasoning": True,
                "reasoning_levels": ["low", "medium", "high"],
                "supports_temperature": True,
            }
    return {
        "supports_reasoning": False,
        "reasoning_levels": [],
        "supports_temperature": True,
    }


async def _fetch_openai_models() -> list[str] | None:
    try:
        response = await llm_client.openai_client.models.list()
        return [model.id for model in response.data]
    except Exception:
        return None


async def _fetch_anthropic_models(api_key: str) -> list[str] | None:
    if not api_key:
        return None
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://api.anthropic.com/v1/models", headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return [item["id"] for item in data.get("data", []) if item.get("id")]
    except Exception:
        return None


async def get_model_catalog() -> ModelCatalog:
    openai_live = await _fetch_openai_models()
    anthropic_live = await _fetch_anthropic_models(llm_client.anthropic_api_key)

    models = []
    models.extend(_merge_models("openai", openai_live, FALLBACK_MODELS["openai"]))
    models.extend(_merge_models("anthropic", anthropic_live, FALLBACK_MODELS["anthropic"]))

    defaults = ModelDefaults(
        model=DEFAULT_MODEL,
        reasoning=DEFAULT_REASONING,
        temperature=DEFAULT_TEMPERATURE,
    )
    return ModelCatalog(defaults=defaults, models=models)
