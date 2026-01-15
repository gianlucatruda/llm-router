"""Usage statistics endpoints."""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db, UsageLog
from models import UsageSummary, ModelInfo
from config import MODELS

router = APIRouter(prefix="/api/usage", tags=["usage"])


@router.get("/summary", response_model=UsageSummary)
async def get_usage_summary(db: AsyncSession = Depends(get_db)):
    """Get overall usage summary with breakdown by model."""

    # Get total usage
    result = await db.execute(
        select(
            func.sum(UsageLog.tokens_input).label("total_input"),
            func.sum(UsageLog.tokens_output).label("total_output"),
            func.sum(UsageLog.cost).label("total_cost"),
        )
    )
    totals = result.one()

    # Get usage by model
    result = await db.execute(
        select(
            UsageLog.model,
            func.sum(UsageLog.tokens_input).label("tokens_input"),
            func.sum(UsageLog.tokens_output).label("tokens_output"),
            func.sum(UsageLog.cost).label("cost"),
            func.count(UsageLog.id).label("requests"),
        ).group_by(UsageLog.model)
    )
    by_model = {
        row.model: {
            "tokens_input": row.tokens_input or 0,
            "tokens_output": row.tokens_output or 0,
            "cost": round(row.cost or 0, 4),
            "requests": row.requests,
        }
        for row in result.all()
    }

    return UsageSummary(
        total_tokens_input=totals.total_input or 0,
        total_tokens_output=totals.total_output or 0,
        total_cost=round(totals.total_cost or 0, 4),
        by_model=by_model,
    )


@router.get("/models", response_model=List[ModelInfo])
async def get_available_models():
    """Get list of available models with pricing info."""
    models = []
    for provider, provider_models in MODELS.items():
        for model_id, config in provider_models.items():
            models.append(
                ModelInfo(
                    id=model_id,
                    name=config["name"],
                    provider=provider,
                    input_cost=config["input_cost"],
                    output_cost=config["output_cost"],
                )
            )
    return models
