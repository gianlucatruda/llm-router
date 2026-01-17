"""Conversation management endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import Conversation, Message, get_db
from models import (
    ConversationListItem,
    ConversationResponse,
    CreateConversationRequest,
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationListItem])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    """List all conversations, sorted by most recent first."""
    result = await db.execute(select(Conversation).order_by(Conversation.updated_at.desc()))
    conversations = result.scalars().all()
    return conversations


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific conversation with all messages."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Sort messages by creation time
    conversation.messages.sort(key=lambda m: m.created_at)

    return conversation


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    request: CreateConversationRequest, db: AsyncSession = Depends(get_db)
):
    """Create a new conversation."""
    conversation = Conversation(
        title=request.title,
        model=request.model,
    )
    db.add(conversation)
    await db.flush()
    await db.refresh(conversation)

    return conversation


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a conversation and all its messages."""
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conversation)
    await db.flush()

    return {"status": "deleted", "id": conversation_id}


@router.post("/{conversation_id}/clone", response_model=ConversationResponse)
async def clone_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Clone a conversation with all its messages."""
    # Get original conversation with messages
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )
    original = result.scalar_one_or_none()

    if not original:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Create new conversation
    cloned = Conversation(
        title=f"{original.title} (clone)",
        model=original.model,
        system_prompt=original.system_prompt,
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
