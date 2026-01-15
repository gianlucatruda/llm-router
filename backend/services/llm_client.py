"""LLM client for interacting with OpenAI API."""
from typing import AsyncGenerator, List, Dict, Any
from openai import AsyncOpenAI
from config import settings


class LLMClient:
    """Unified client for LLM providers."""

    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def stream_chat(
        self,
        provider: str,
        model: str,
        messages: List[Dict[str, str]]
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
        if provider == "openai":
            async for token in self._stream_openai(model, messages):
                yield token
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    async def _stream_openai(
        self,
        model: str,
        messages: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        """Stream completions from OpenAI API."""
        try:
            stream = await self.openai_client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")

    async def get_completion_metadata(
        self,
        provider: str,
        model: str,
        messages: List[Dict[str, str]],
        completion: str
    ) -> Dict[str, Any]:
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
            input_tokens = sum(
                len(encoding.encode(msg["content"]))
                for msg in messages
            )

            # Count output tokens
            output_tokens = len(encoding.encode(completion))

            return {
                "tokens_input": input_tokens,
                "tokens_output": output_tokens,
            }

        raise ValueError(f"Unsupported provider: {provider}")


# Singleton instance
llm_client = LLMClient()
