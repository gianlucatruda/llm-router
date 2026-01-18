"""Model catalog builder with live fetch + fallback metadata."""

from __future__ import annotations

from typing import Any

import httpx

from config import DEFAULT_MODEL, DEFAULT_REASONING, DEFAULT_TEMPERATURE, FALLBACK_MODELS
from models import ModelCatalog, ModelDefaults, ModelInfo
from services.llm_client import llm_client

OPENAI_EXCLUDE_SUBSTRINGS = ("audio", "realtime")


def _is_openai_reasoning_model(model_id: str) -> bool:
    return model_id.startswith("o") and len(model_id) > 1 and model_id[1].isdigit()


def _is_openai_model_id(model_id: str) -> bool:
    return model_id.startswith("gpt-") or _is_openai_reasoning_model(model_id)


def _is_anthropic_model_id(model_id: str) -> bool:
    return model_id.startswith("claude")


def _merge_models(
    provider: str, live_models: list[str] | None, fallback: dict[str, dict]
) -> list[ModelInfo]:
    models: list[ModelInfo] = []
    live_set = set(live_models or [])
    allow_fallback_only = not live_models
    if live_models:
        for model_id in sorted(live_set):
            if provider == "openai" and not _is_openai_model_id(model_id):
                continue
            if provider == "anthropic" and not _is_anthropic_model_id(model_id):
                continue
            if provider == "openai" and any(part in model_id for part in OPENAI_EXCLUDE_SUBSTRINGS):
                continue
            fallback_meta = fallback.get(model_id, {})
            inferred = _infer_capabilities(provider, model_id)
            name = _coerce_str(fallback_meta.get("name"), model_id)
            supports_reasoning = _coerce_bool(
                fallback_meta.get("supports_reasoning"), inferred["supports_reasoning"]
            )
            reasoning_levels = _coerce_str_list(
                fallback_meta.get("reasoning_levels"), inferred["reasoning_levels"]
            )
            supports_temperature = _coerce_bool(
                fallback_meta.get("supports_temperature"), inferred["supports_temperature"]
            )
            models.append(
                ModelInfo(
                    id=model_id,
                    name=name,
                    provider=provider,
                    input_cost=fallback_meta.get("input_cost", 0),
                    output_cost=fallback_meta.get("output_cost", 0),
                    source="live",
                    pricing_source="fallback" if model_id in fallback else "unknown",
                    available=True,
                    supports_reasoning=supports_reasoning,
                    reasoning_levels=reasoning_levels,
                    supports_temperature=supports_temperature,
                )
            )
    for model_id, meta in fallback.items():
        if not allow_fallback_only and model_id in live_set:
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
                available=allow_fallback_only or model_id in live_set,
                supports_reasoning=meta.get("supports_reasoning", False),
                reasoning_levels=meta.get("reasoning_levels", []),
                supports_temperature=meta.get("supports_temperature", True),
            )
        )
    return models


def _infer_capabilities(provider: str, model_id: str) -> dict[str, Any]:
    if provider == "openai":
        if _is_openai_reasoning_model(model_id):
            return {
                "supports_reasoning": True,
                "reasoning_levels": ["low", "medium", "high"],
                "supports_temperature": False,
            }
        if model_id.startswith("gpt-5"):
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


def _coerce_str(value: Any, fallback: str) -> str:
    if isinstance(value, str) and value:
        return value
    return fallback


def _coerce_bool(value: Any, fallback: bool) -> bool:
    if isinstance(value, bool):
        return value
    return fallback


def _coerce_str_list(value: Any, fallback: list[str]) -> list[str]:
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return value
    return fallback


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
