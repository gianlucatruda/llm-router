# LLM Router - Product Spec

## Summary
- Self-hosted, single-user LLM router with a retro terminal UI.
- Mobile-first web app that routes prompts through personal API keys.
- Single container deployment: FastAPI backend, SQLite database, static frontend.

## Decisions (v0.2 locked)
- Single container deployment with FastAPI + SQLite.
- Vanilla TypeScript + Vite frontend, no frameworks.
- No auth in v0.2; rely on network isolation.
- Minimal dependencies and explicit, readable code.

## Current Scope (v0.2 implemented)
- Chat: SSE streaming and non-streaming submit.
- Conversations: list, fetch, create, delete, clone.
- System prompts: append per conversation.
- Usage tracking: per-model totals with overall or device scope.
- Model catalog endpoint with pricing metadata.
- Image generation endpoint (OpenAI).
- Providers: OpenAI and Anthropic.
- FastAPI serves static frontend in production.

## Architecture Summary
- Backend: FastAPI async + SQLAlchemy async (aiosqlite), SSE for streaming.
- Frontend: vanilla TypeScript components with lightweight store, Vite build.
- Deployment: single Docker image, Docker Compose for local or homelab.

## Data Model
```
conversations (id, title, model, system_prompt, device_id, created_at, updated_at)
messages (id, conversation_id, role, content, model, temperature, reasoning, status,
         tokens_input, tokens_output, cost, created_at)
usage_logs (id, conversation_id, model, provider, device_id,
           tokens_input, tokens_output, cost, timestamp)
```

## API Endpoints (current)
- GET /health
- POST /api/chat/stream
- POST /api/chat/submit
- GET /api/conversations
- GET /api/conversations/{id}
- POST /api/conversations
- DELETE /api/conversations/{id}
- POST /api/conversations/{id}/clone
- POST /api/conversations/{id}/system
- GET /api/usage/summary?scope=overall|device
- GET /api/usage/models
- POST /api/images/generate

## Configuration
Required:
- OPENAI_API_KEY

Optional:
- ANTHROPIC_API_KEY
- DATABASE_PATH (default: ./data/llm-router.db)

## Testing Status
- Smoke scripts live in `scripts/` (api, image, ux).
- Unit and integration tests are still pending.

## Roadmap (v0.3 deferred)
- Conversation search.
- Authentication and API key management UI.
- Multi-user support.
- Usage analytics dashboard (graphs, trends).
- Export conversations (JSON/Markdown/PDF).
- Prompt templates or library.
- Dark mode toggle.
- Vision or image upload support.
- PWA support.
- Advanced deployment stack (reverse proxy, HTTPS automation).

## References
- Developer workflow and commands: `AGENTS.md`.
- Setup and usage overview: `README.md`.
