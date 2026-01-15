"""Pydantic models for API requests and responses."""
from typing import Optional, List
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    model: str = "gpt-4o"


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    model: Optional[str] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    cost: Optional[float] = None
    created_at: int

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    title: str
    model: str
    created_at: int
    updated_at: int
    messages: Optional[List[MessageResponse]] = None

    class Config:
        from_attributes = True


class ConversationListItem(BaseModel):
    id: str
    title: str
    model: str
    created_at: int
    updated_at: int

    class Config:
        from_attributes = True


class CreateConversationRequest(BaseModel):
    title: str
    model: str = "gpt-4o"


class UsageSummary(BaseModel):
    total_tokens_input: int
    total_tokens_output: int
    total_cost: float
    by_model: dict


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    input_cost: float
    output_cost: float
