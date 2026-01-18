"""Conversation management endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import Conversation, Message, get_db
from models import (
    ConversationListItem,
    ConversationResponse,
    CreateConversationRequest,
    SystemPromptUpdateRequest,
)
from services.system_prompt import append_system_text

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationListItem])
async def list_conversations(request: Request, db: AsyncSession = Depends(get_db)):
    """List all conversations, sorted by most recent first."""
    device_id = getattr(request.state, "device_id", None)
    result = await db.execute(
        select(Conversation)
        .where(Conversation.device_id == device_id)
        .order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()
    return conversations


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    """Get a specific conversation with all messages."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id, Conversation.device_id == request.state.device_id
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Sort messages by creation time
    conversation.messages.sort(key=lambda m: m.created_at)

    return conversation


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    request: CreateConversationRequest, http_request: Request, db: AsyncSession = Depends(get_db)
):
    """Create a new conversation."""
    conversation = Conversation(
        title=request.title,
        model=request.model,
        device_id=getattr(http_request.state, "device_id", None),
    )
    db.add(conversation)
    await db.flush()
    await db.refresh(conversation)

    return conversation


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    """Delete a conversation and all its messages."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.device_id == request.state.device_id
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conversation)
    await db.flush()

    return {"status": "deleted", "id": conversation_id}


@router.post("/{conversation_id}/clone", response_model=ConversationResponse)
async def clone_conversation(
    conversation_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    """Clone a conversation with all its messages."""
    # Get original conversation with messages
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            Conversation.id == conversation_id, Conversation.device_id == request.state.device_id
        )
    )
    original = result.scalar_one_or_none()

    if not original:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Create new conversation
    cloned = Conversation(
        title=f"{original.title} (clone)",
        model=original.model,
        system_prompt=original.system_prompt,
        device_id=original.device_id,
    )
    db.add(cloned)
    await db.flush()

    # Clone all messages
    for msg in sorted(original.messages, key=lambda m: m.created_at):
        cloned_msg = Message(
            conversation_id=cloned.id,
            role=msg.role,
            content=msg.content,
            model=msg.model,
            temperature=msg.temperature,
            reasoning=msg.reasoning,
            status=msg.status,
            tokens_input=msg.tokens_input,
            tokens_output=msg.tokens_output,
            cost=msg.cost,
        )
        db.add(cloned_msg)

    await db.flush()
    await db.refresh(cloned)

    # Load messages for response
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == cloned.id)
    )
    cloned = result.scalar_one()

    return cloned


@router.post("/{conversation_id}/system")
async def append_system_prompt(
    conversation_id: str,
    request: SystemPromptUpdateRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Append system prompt text for a conversation."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.device_id == http_request.state.device_id,
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not request.system_text.strip():
        raise HTTPException(status_code=400, detail="System text cannot be empty")

    conversation.system_prompt = append_system_text(conversation.system_prompt, request.system_text)
    conversation.updated_at = int(datetime.now().timestamp())
    await db.flush()

    return {"status": "updated"}
