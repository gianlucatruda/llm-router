"""Chat API endpoints with SSE streaming and background processing."""

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_provider
from database import Conversation, Message, async_session_maker, get_db
from models import ChatRequest, ChatSubmitResponse
from services.llm_client import llm_client
from services.system_prompt import append_system_text
from services.usage_tracker import calculate_cost, log_usage

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/stream")
async def stream_chat(
    request: ChatRequest, http_request: Request, db: AsyncSession = Depends(get_db)
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
                    select(Conversation).where(
                        Conversation.id == request.conversation_id,
                        Conversation.device_id == http_request.state.device_id,
                    )
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
                    device_id=getattr(http_request.state, "device_id", None),
                )
                db.add(conversation)
                await db.flush()

            if request.system_text:
                conversation.system_prompt = append_system_text(
                    conversation.system_prompt, request.system_text
                )
            conversation.model = request.model

            # Save user message
            user_message = Message(
                conversation_id=conversation.id,
                role="user",
                content=request.message,
                temperature=request.temperature,
                reasoning=request.reasoning,
                status="complete",
            )
            db.add(user_message)

            # Commit conversation and user message before streaming
            await db.commit()

            message_history = await build_message_history(db, conversation.id)

            # Stream completion
            provider = get_provider(request.model)
            assistant_content = ""

            async for token in llm_client.stream_chat(
                provider=provider,
                model=request.model,
                messages=message_history,
                temperature=request.temperature,
                reasoning=request.reasoning,
                system_prompt=conversation.system_prompt,
            ):
                assistant_content += token
                yield f"data: {json.dumps({'token': token})}\n\n"

            # Get token counts and calculate cost
            metadata_messages = message_history
            if request.reasoning:
                metadata_messages = [
                    {"role": "system", "content": f"Reasoning level: {request.reasoning}."},
                    *message_history,
                ]
            metadata = await llm_client.get_completion_metadata(
                provider=provider,
                model=request.model,
                messages=metadata_messages,
                completion=assistant_content,
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
                temperature=request.temperature,
                reasoning=request.reasoning,
                status="complete",
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                cost=cost,
            )
            db.add(assistant_message)

            # Update conversation timestamp
            conversation.updated_at = int(datetime.now().timestamp())

            # Log usage
            await log_usage(
                db=db,
                conversation_id=conversation.id,
                model=request.model,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                device_id=getattr(http_request.state, "device_id", None),
            )

            # Commit all changes to database
            await db.commit()

            # Send completion event
            completion_data = {
                "done": True,
                "conversation_id": conversation.id,
                "cost": cost,
                "tokens": tokens_input + tokens_output,
            }
            yield f"data: {json.dumps(completion_data)}\n\n"

        except Exception as e:
            import traceback

            error_details = traceback.format_exc()
            print(f"ERROR in stream_chat: {error_details}")  # Log to console
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post("/submit", response_model=ChatSubmitResponse)
async def submit_chat(
    request: ChatRequest, http_request: Request, db: AsyncSession = Depends(get_db)
):
    """Submit a chat request for background processing."""
    if request.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == request.conversation_id,
                Conversation.device_id == http_request.state.device_id,
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title = request.message[:50] + ("..." if len(request.message) > 50 else "")
        conversation = Conversation(
            title=title,
            model=request.model,
            device_id=getattr(http_request.state, "device_id", None),
        )
        db.add(conversation)
        await db.flush()

    if request.system_text:
        conversation.system_prompt = append_system_text(
            conversation.system_prompt, request.system_text
        )
    conversation.model = request.model

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=request.message,
        temperature=request.temperature,
        reasoning=request.reasoning,
        status="complete",
    )
    db.add(user_message)

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content="",
        model=request.model,
        temperature=request.temperature,
        reasoning=request.reasoning,
        status="pending",
    )
    db.add(assistant_message)
    await db.commit()

    asyncio.create_task(
        run_background_completion(
            conversation_id=conversation.id,
            assistant_message_id=assistant_message.id,
            model=request.model,
            temperature=request.temperature,
            reasoning=request.reasoning,
            system_text=None,
            device_id=getattr(http_request.state, "device_id", None),
        )
    )

    return ChatSubmitResponse(
        conversation_id=conversation.id,
        assistant_message_id=assistant_message.id,
    )


async def run_background_completion(
    conversation_id: str,
    assistant_message_id: str,
    model: str,
    temperature: float | None,
    reasoning: str | None,
    system_text: str | None,
    device_id: str | None,
) -> None:
    async with async_session_maker() as session:
        try:
            result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one()
            if system_text:
                conversation.system_prompt = append_system_text(
                    conversation.system_prompt, system_text
                )

            message_history = await build_message_history(session, conversation_id)
            provider = get_provider(model)
            assistant_content = ""
            async for token in llm_client.stream_chat(
                provider=provider,
                model=model,
                messages=message_history,
                temperature=temperature,
                reasoning=reasoning,
                system_prompt=conversation.system_prompt,
            ):
                assistant_content += token

            metadata_messages = message_history
            if reasoning:
                metadata_messages = [
                    {"role": "system", "content": f"Reasoning level: {reasoning}."},
                    *message_history,
                ]
            metadata = await llm_client.get_completion_metadata(
                provider=provider,
                model=model,
                messages=metadata_messages,
                completion=assistant_content,
            )
            tokens_input = metadata["tokens_input"]
            tokens_output = metadata["tokens_output"]
            cost = calculate_cost(model, tokens_input, tokens_output)

            result = await session.execute(
                select(Message).where(Message.id == assistant_message_id)
            )
            assistant_message = result.scalar_one()
            assistant_message.content = assistant_content
            assistant_message.tokens_input = tokens_input
            assistant_message.tokens_output = tokens_output
            assistant_message.cost = cost
            assistant_message.status = "complete"

            conversation.updated_at = int(datetime.now().timestamp())

            await log_usage(
                db=session,
                conversation_id=conversation_id,
                model=model,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                device_id=device_id,
            )
            await session.commit()
        except Exception as exc:
            result = await session.execute(
                select(Message).where(Message.id == assistant_message_id)
            )
            assistant_message = result.scalar_one_or_none()
            if assistant_message:
                assistant_message.status = "error"
                assistant_message.content = f"Error: {exc}"
                await session.commit()


async def build_message_history(db: AsyncSession, conversation_id: str) -> list[dict[str, str]]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    message_history: list[dict[str, str]] = []
    conversation_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    system_prompt = conversation.system_prompt if conversation else None
    if system_prompt:
        message_history.append({"role": "system", "content": system_prompt})
    message_history.extend(
        {"role": msg.role, "content": msg.content}
        for msg in messages
        if msg.role != "system" and msg.content and msg.status not in {"pending", "error"}
    )
    return message_history
