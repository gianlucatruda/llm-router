"""Usage statistics endpoints."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import UsageLog, get_db
from models import ModelCatalog, UsageSummary
from services.model_catalog import get_model_catalog

router = APIRouter(prefix="/api/usage", tags=["usage"])


@router.get("/summary", response_model=UsageSummary)
async def get_usage_summary(
    request: Request, scope: str = "overall", db: AsyncSession = Depends(get_db)
):
    """Get overall usage summary with breakdown by model."""
    if scope not in {"overall", "device"}:
        scope = "overall"
    device_id = getattr(request.state, "device_id", None)
    filters = []
    if scope == "device" and device_id:
        filters.append(UsageLog.device_id == device_id)

    # Get total usage
    result = await db.execute(
        select(
            func.sum(UsageLog.tokens_input).label("total_input"),
            func.sum(UsageLog.tokens_output).label("total_output"),
            func.sum(UsageLog.cost).label("total_cost"),
        ).where(*filters)
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
        ).where(*filters)
        .group_by(UsageLog.model)
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


@router.get("/models", response_model=ModelCatalog)
async def get_available_models():
    """Get list of available models with pricing info."""
    return await get_model_catalog()
