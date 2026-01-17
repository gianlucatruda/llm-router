"""Database models and setup for LLM Router."""

import uuid
from collections.abc import AsyncGenerator
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from config import settings


class Base(DeclarativeBase):
    pass


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[int] = mapped_column(
        Integer, nullable=False, default=lambda: int(datetime.now().timestamp())
    )
    updated_at: Mapped[int] = mapped_column(
        Integer, nullable=False, default=lambda: int(datetime.now().timestamp())
    )

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(
        String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=True)
    tokens_input: Mapped[int] = mapped_column(Integer, nullable=True)
    tokens_output: Mapped[int] = mapped_column(Integer, nullable=True)
    cost: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[int] = mapped_column(
        Integer, nullable=False, default=lambda: int(datetime.now().timestamp())
    )

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(
        String, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
    model: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    tokens_input: Mapped[int] = mapped_column(Integer, nullable=False)
    tokens_output: Mapped[int] = mapped_column(Integer, nullable=False)
    cost: Mapped[float] = mapped_column(Float, nullable=False)
    device_id: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[int] = mapped_column(
        Integer, nullable=False, default=lambda: int(datetime.now().timestamp())
    )

    __table_args__ = (
        Index("idx_usage_logs_timestamp", "timestamp"),
        Index("idx_usage_logs_device_id", "device_id"),
    )


# Create async engine
engine = create_async_engine(
    f"sqlite+aiosqlite:///{settings.database_path}",
    echo=False,
)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Initialize database tables."""
    import os

    os.makedirs(os.path.dirname(settings.database_path), exist_ok=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        result = await conn.exec_driver_sql("PRAGMA table_info(usage_logs)")
        columns = {row[1] for row in result.fetchall()}
        if "device_id" not in columns:
            await conn.exec_driver_sql("ALTER TABLE usage_logs ADD COLUMN device_id VARCHAR")
        await conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS idx_usage_logs_device_id ON usage_logs(device_id)"
        )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
