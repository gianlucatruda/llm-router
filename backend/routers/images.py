"""Image generation endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Conversation, Message, get_db
from services.llm_client import llm_client

router = APIRouter(prefix="/api/images", tags=["images"])


class ImageRequest(BaseModel):
    prompt: str
    model: str = "dall-e-3"
    size: str = "1024x1024"
    conversation_id: str | None = None


class ImageResponse(BaseModel):
    conversation_id: str
    message_id: str
    url: str


@router.post("/generate", response_model=ImageResponse)
async def generate_image(request: ImageRequest, db: AsyncSession = Depends(get_db)):
    if request.conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == request.conversation_id)
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title = request.prompt[:50] + ("..." if len(request.prompt) > 50 else "")
        conversation = Conversation(title=title, model=request.model)
        db.add(conversation)
        await db.flush()

    url = await llm_client.generate_image(
        prompt=request.prompt, model=request.model, size=request.size
    )
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=f"/image {request.prompt} model={request.model} size={request.size}",
        status="complete",
    )
    db.add(user_message)
    message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=f"![generated image]({url})",
        model=request.model,
        status="complete",
    )
    db.add(message)
    conversation.updated_at = int(datetime.now().timestamp())
    await db.commit()
    await db.refresh(message)

    return ImageResponse(conversation_id=conversation.id, message_id=message.id, url=url)
