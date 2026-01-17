# LLM Router - Product Spec

## Project Overview

Retro terminal-inspired, mobile-first web app that routes queries through personal API keys. Designed for self-hosted single-user setups with a single-container deployment (FastAPI + SQLite + static frontend).

## Current Architecture (Implemented)

- **Frontend**: Vanilla TypeScript + Vite
- **Backend**: FastAPI (async) + SQLite (aiosqlite)
- **Deployment**: Single Docker image; Docker Compose for homelab
- **Providers**: OpenAI + Anthropic
- **Identity**: Device-scoped usage tracking

## v0.2.0 Requirements (Implemented)

### Visual + UX
- Retro terminal-inspired, Tokyo Night aesthetic with Ubuntu Mono Nerd Font (CDN).
- Mobile-first; touch-friendly; copy button per message.
- Rich formatting (markdown + code highlighting) styled like a TUI.

### Models + Controls
- Dynamic model catalogs from provider APIs; fallback list when unavailable.
- Includes OpenAI + Anthropic, reasoning models (o1/o3), GPT-5.x, Claude Sonnet 4.5.
- Default: GPT-5.1 with low reasoning.
- Slash commands with autocomplete:
  - `/model <name|id>`
  - `/temp <0-2>`
  - `/reasoning <low|medium|high>`
  - `/help`
- Command definitions centralized for easy edits.

### Statistics
- Device + overall usage (tokens + cost) surfaced in UI.

### Background Processing
- Submit a request, create a pending assistant message, and poll until complete.
- Responses finish even if the UI is closed; refresh resumes via polling.
- Device identity uses localStorage-first with cookie fallback.
- When the UI is active and online, responses stream in real time.

### Commands + Media
- `/system` to append per-conversation system prompt.
- `/image` for OpenAI image generation (DALL·E 2/3, gpt-image).

### Deployment
- Docker Compose remains simple and robust for homelab usage.

## v0.3 Requirements (Planned)

- Conversation search.
- Authentication / API key management UI.
- Multi-user support.
- Usage analytics dashboard (graphs, trends).
- Export conversations (JSON/Markdown/PDF).
- Prompt templates/library.
- Dark mode toggle.
- Vision/image upload support.
- PWA support.
- Advanced deployment stack (reverse proxy, HTTPS automation).

## API Endpoints (Current)

- `POST /api/chat/stream` (SSE streaming)
- `POST /api/chat/submit` (background completion)
- `GET /api/conversations`
- `GET /api/conversations/{id}`
- `POST /api/conversations`
- `DELETE /api/conversations/{id}`
- `POST /api/conversations/{id}/clone`
- `GET /api/usage/summary?scope=overall|device`
- `GET /api/usage/models`
- `POST /api/images/generate`

## Notes

- No auth in v0.2.0/v0.3; rely on network isolation.
- Single container per environment; SQLite persists at `./data/llm-router.db`.
