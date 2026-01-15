"""Usage tracking and cost calculation."""
from config import get_model_config, get_provider
from database import UsageLog, async_session_maker


def calculate_cost(model: str, tokens_input: int, tokens_output: int) -> float:
    """
    Calculate cost in USD for a given model and token usage.

    Args:
        model: Model identifier
        tokens_input: Number of input tokens
        tokens_output: Number of output tokens

    Returns:
        Cost in USD
    """
    config = get_model_config(model)
    input_cost = (tokens_input / 1000) * config["input_cost"]
    output_cost = (tokens_output / 1000) * config["output_cost"]
    return input_cost + output_cost


async def log_usage(
    conversation_id: str,
    model: str,
    tokens_input: int,
    tokens_output: int,
) -> None:
    """
    Log usage to the database.

    Args:
        conversation_id: Conversation ID
        model: Model identifier
        tokens_input: Number of input tokens
        tokens_output: Number of output tokens
    """
    provider = get_provider(model)
    cost = calculate_cost(model, tokens_input, tokens_output)

    async with async_session_maker() as session:
        usage_log = UsageLog(
            conversation_id=conversation_id,
            model=model,
            provider=provider,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            cost=cost,
        )
        session.add(usage_log)
        await session.commit()
