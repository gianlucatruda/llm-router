"""Chat API endpoints with SSE streaming."""
import json
from datetime import datetime
from typing import List, Dict
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db, Conversation, Message
from models import ChatRequest
from services.llm_client import llm_client
from services.usage_tracker import calculate_cost, log_usage
from config import get_provider

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Stream chat completion via Server-Sent Events.

    Accepts a user message and optional conversation_id.
    Creates new conversation if none provided.
    Streams assistant response token by token.
    """

    async def event_generator():
        try:
            # Get or create conversation
            if request.conversation_id:
                result = await db.execute(
                    select(Conversation).where(Conversation.id == request.conversation_id)
                )
                conversation = result.scalar_one_or_none()
                if not conversation:
                    yield f"data: {json.dumps({'error': 'Conversation not found'})}\n\n"
                    return
            else:
                # Create new conversation with title from first message
                title = request.message[:50] + ("..." if len(request.message) > 50 else "")
                conversation = Conversation(
                    title=title,
                    model=request.model,
                )
                db.add(conversation)
                await db.flush()

            # Save user message
            user_message = Message(
                conversation_id=conversation.id,
                role="user",
                content=request.message,
            )
            db.add(user_message)
            await db.flush()

            # Load conversation history
            result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at)
            )
            messages = result.scalars().all()

            # Convert to OpenAI format
            message_history: List[Dict[str, str]] = [
                {"role": msg.role, "content": msg.content}
                for msg in messages
            ]

            # Stream completion
            provider = get_provider(request.model)
            assistant_content = ""

            async for token in llm_client.stream_chat(
                provider=provider,
                model=request.model,
                messages=message_history
            ):
                assistant_content += token
                yield f"data: {json.dumps({'token': token})}\n\n"

            # Get token counts and calculate cost
            metadata = await llm_client.get_completion_metadata(
                provider=provider,
                model=request.model,
                messages=message_history,
                completion=assistant_content
            )

            tokens_input = metadata["tokens_input"]
            tokens_output = metadata["tokens_output"]
            cost = calculate_cost(request.model, tokens_input, tokens_output)

            # Save assistant message
            assistant_message = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=assistant_content,
                model=request.model,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                cost=cost,
            )
            db.add(assistant_message)

            # Update conversation timestamp
            conversation.updated_at = int(datetime.now().timestamp())
            await db.flush()

            # Log usage
            await log_usage(
                conversation_id=conversation.id,
                model=request.model,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
            )

            # Send completion event
            yield f"data: {json.dumps({{'done': True, 'conversation_id': conversation.id, 'cost': cost, 'tokens': tokens_input + tokens_output}})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
