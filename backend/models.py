"""Pydantic models for API requests and responses."""

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    model: str = "gpt-5.1"
    temperature: float | None = None
    reasoning: str | None = None
    system_text: str | None = None


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    model: str | None = None
    temperature: float | None = None
    reasoning: str | None = None
    status: str | None = None
    tokens_input: int | None = None
    tokens_output: int | None = None
    cost: float | None = None
    created_at: int

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    title: str
    model: str
    created_at: int
    updated_at: int
    system_prompt: str | None = None
    messages: list[MessageResponse] | None = None

    class Config:
        from_attributes = True


class ConversationListItem(BaseModel):
    id: str
    title: str
    model: str
    created_at: int
    updated_at: int
    system_prompt: str | None = None

    class Config:
        from_attributes = True


class CreateConversationRequest(BaseModel):
    title: str
    model: str = "gpt-5.1"


class SystemPromptUpdateRequest(BaseModel):
    system_text: str


class SystemPromptUpdateResponse(BaseModel):
    status: str
    conversation_id: str
    model: str
    provider: str
    system_prompt: str
    system_prompt_length: int


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
    source: str
    pricing_source: str
    available: bool
    supports_reasoning: bool
    reasoning_levels: list[str]
    supports_temperature: bool


class ModelDefaults(BaseModel):
    model: str
    reasoning: str
    temperature: float


class ModelCatalog(BaseModel):
    defaults: ModelDefaults
    models: list[ModelInfo]


class ChatSubmitResponse(BaseModel):
    conversation_id: str
    assistant_message_id: str
