"""LLM client for interacting with OpenAI and Anthropic APIs."""

from collections.abc import AsyncGenerator
from typing import Any

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from config import get_model_config, settings


class LLMClient:
    """Unified client for LLM providers."""

    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.anthropic_api_key = settings.anthropic_api_key

    async def stream_chat(
        self,
        provider: str,
        model: str,
        messages: list[dict[str, str]],
        temperature: float | None = None,
        reasoning: str | None = None,
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completions from the specified provider.

        Args:
            provider: Provider name ("openai" or "anthropic")
            model: Model identifier
            messages: List of message dicts with "role" and "content"

        Yields:
            Token strings as they arrive
        """
        temperature = self._normalize_temperature(model, temperature)
        if provider == "openai":
            async for token in self._stream_openai(model, messages, temperature, reasoning):
                yield token
        elif provider == "anthropic":
            async for token in self._stream_anthropic(
                model, messages, temperature, reasoning, system_prompt
            ):
                yield token
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    async def _stream_openai(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float | None,
        reasoning: str | None,
    ) -> AsyncGenerator[str, None]:
        """Stream completions from OpenAI API."""
        try:
            if _use_responses_api(model):
                async for token in self._stream_openai_responses(
                    model, messages, temperature, reasoning
                ):
                    yield token
            else:
                payload_messages = self._apply_reasoning(messages, reasoning)
                params: dict[str, Any] = {
                    "model": model,
                    "messages": payload_messages,
                    "stream": True,
                }
                if temperature is not None:
                    params["temperature"] = temperature
                stream = await self.openai_client.chat.completions.create(**params)

                async for chunk in stream:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content

        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}") from e

    async def _stream_anthropic(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float | None,
        reasoning: str | None,
        system_prompt: str | None,
    ) -> AsyncGenerator[str, None]:
        """Stream completions from Anthropic API."""
        try:
            resolved_system = (system_prompt or "").strip()
            if not resolved_system:
                resolved_system = "\n".join(
                    msg["content"] for msg in messages if msg.get("role") == "system"
                ).strip()
            filtered_messages = [
                msg for msg in messages if msg.get("role") in {"user", "assistant"}
            ]
            params: dict[str, Any] = {
                "model": model,
                "messages": filtered_messages,
                "max_tokens": 1024,
            }
            if temperature is not None:
                params["temperature"] = temperature
            system_bits = []
            if resolved_system:
                system_bits.append(resolved_system)
            if reasoning:
                system_bits.append(f"Reasoning level: {reasoning}.")
            if system_bits:
                params["system"] = "\n".join(system_bits)

            stream = await self.anthropic_client.messages.create(**params, stream=True)
            async for event in stream:
                if getattr(event, "type", "") == "content_block_delta":
                    delta = getattr(event, "delta", None)
                    text = getattr(delta, "text", None)
                    if text:
                        yield text
        except Exception as e:
            raise Exception(f"Anthropic API error: {str(e)}") from e

    def _apply_reasoning(
        self, messages: list[dict[str, str]], reasoning: str | None
    ) -> list[dict[str, str]]:
        if not reasoning:
            return messages
        return [
            {"role": "system", "content": f"Reasoning level: {reasoning}."},
            *messages,
        ]

    def _normalize_temperature(self, model: str, temperature: float | None) -> float | None:
        if temperature is None:
            return None
        config = get_model_config(model)
        if not config.get("supports_temperature", True):
            return None
        return temperature

    async def _stream_openai_responses(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float | None,
        reasoning: str | None,
    ) -> AsyncGenerator[str, None]:
        input_items = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages
            if msg.get("content")
        ]
        params: dict[str, Any] = {
            "model": model,
            "input": input_items,
            "stream": True,
        }
        if temperature is not None:
            params["temperature"] = temperature
        if reasoning:
            params["reasoning"] = {"effort": reasoning}
        stream = await self.openai_client.responses.create(**params)
        async for event in stream:
            if getattr(event, "type", "") == "response.output_text.delta":
                yield event.delta

    async def get_completion_metadata(
        self, provider: str, model: str, messages: list[dict[str, str]], completion: str
    ) -> dict[str, Any]:
        """
        Get token usage metadata for a completion.
        This is called after streaming to get accurate token counts.
        """
        if provider == "openai":
            # For OpenAI, we'll use tiktoken to estimate tokens
            import tiktoken

            try:
                encoding = tiktoken.encoding_for_model(model)
            except KeyError:
                encoding = tiktoken.get_encoding("cl100k_base")

            # Count input tokens
            input_tokens = sum(len(encoding.encode(msg["content"])) for msg in messages)

            # Count output tokens
            output_tokens = len(encoding.encode(completion))

            return {
                "tokens_input": input_tokens,
                "tokens_output": output_tokens,
            }
        if provider == "anthropic":
            input_tokens = sum(max(1, len(msg["content"]) // 4) for msg in messages)
            output_tokens = max(1, len(completion) // 4)
            return {
                "tokens_input": input_tokens,
                "tokens_output": output_tokens,
            }

        raise ValueError(f"Unsupported provider: {provider}")

    async def generate_image(self, prompt: str, model: str, size: str) -> str:
        result = await self.openai_client.images.generate(
            model=model,
            prompt=prompt,
            size=size,
        )
        return result.data[0].url

    def uses_responses_api(self, model: str) -> bool:
        return _use_responses_api(model)


def _use_responses_api(model: str) -> bool:
    model_id = model.lower()
    return model_id.startswith("gpt-5") or (
        model_id.startswith("o") and len(model_id) > 1 and model_id[1].isdigit()
    )


# Singleton instance
llm_client = LLMClient()
