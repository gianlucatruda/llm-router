import pytest

from config import get_model_config, get_provider


def test_get_provider_openai_variants() -> None:
    assert get_provider("gpt-5.1") == "openai"
    assert get_provider("o1-mini") == "openai"
    assert get_provider("o3-mini") == "openai"


def test_get_provider_anthropic_variants() -> None:
    assert get_provider("claude-3-5-haiku-20241022") == "anthropic"


def test_get_provider_unknown_raises() -> None:
    with pytest.raises(ValueError):
        get_provider("custom-model-123")


def test_gpt5_temperature_disabled() -> None:
    assert get_model_config("gpt-5.1")["supports_temperature"] is False
    assert get_model_config("gpt-5.2")["supports_temperature"] is False
