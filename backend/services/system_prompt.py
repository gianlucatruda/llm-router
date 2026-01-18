"""System prompt helpers."""


def append_system_text(current: str | None, addition: str | None) -> str:
    """Append new system prompt text with newline separation."""
    if not addition:
        return (current or "").strip()
    if not current:
        return addition.strip()
    return f"{current.strip()}\n{addition.strip()}"
