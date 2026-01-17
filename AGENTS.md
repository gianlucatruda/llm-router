# LLM Router - Developer Guide

Technical documentation for developers and AI agents working on this codebase.

## Project Philosophy & Preferences

This project follows specific design principles and tooling preferences:

### Tooling
- **Python**: Use `uv` for dependency management (NOT pip/venv)
  - `uv sync` to install dependencies
  - `uv run` to execute commands
  - `pyproject.toml` for dependency declaration (NOT requirements.txt)
  - Much faster and more analogous to npm/Node workflow
- **Frontend**: Vanilla TypeScript + Vite
  - NO heavy frameworks (React, Vue, etc.)
  - Keep bundle size minimal
  - Use native Web APIs where possible
- **TypeScript**: Preferred for frontend even though slightly more build complexity
  - Type safety worth the trade-off
  - Better IDE support

### Architecture
- **Single container deployment** - Simplify hosting, reduce moving parts
- **SQLite** - No separate database server to manage
- **Minimal dependencies** - Each dependency is a liability
- **Modular and configurable** - Easy to adapt and extend
- **Retro terminal-inspired, aesthetic UI** - Feels like a classic terminal, not a generic chat app
- **Mobile-first** - Phone usage is primary, desktop secondary

### Code Style
- **Lightweight and lean** - Prefer simple solutions over clever ones
- **Explicit over implicit** - Clear code > terse code
- **Avoid premature optimization** - Make it work, then make it fast
- **No auth in v0** - Security via network isolation first
- **Developer experience** - Fast iteration, hot reload, clear errors

### Deployment
- **Self-hosted first** - Raspberry Pi 5, VPS, homelab
- **Docker Compose** - One command deployment
- **Portable** - Same setup works on ARM and x86
- **Single language per layer** - Don't mix Python/JS in backend or frontend

### Development Workflow
- **Local dev**: Native Python (uv) + Vite dev server (hot reload both)
- **Production**: Single Docker container (frontend built into backend)
- **No separate frontend server** - FastAPI serves static files in prod

### UX/Test Automation (Codex Sessions)
- **Backend dev server**: run `uv sync` in `backend`, then `uv run uvicorn main:app --reload`
- **Frontend dev server**: run `npm install` in `frontend`, then `npm run dev`
- **Playwright UX smoke**: `node scripts/ux-smoke.js` (takes screenshots in `docs/screenshots/`)
- **Extended UX smoke**: `node scripts/ux-extended.js` (cloning + refresh persistence checks)
- **API smoke**: `node scripts/api-smoke.js`
- Use real API keys from `.env` for live testing (no mocks for v1)

### What to Avoid
- Heavy frameworks when vanilla JS suffices
- Microservices (this is a single-user app)
- Over-engineering auth (network security first)
- Cloud-native complexity (K8s, service mesh, etc.)
- Multiple containers when one will do
- Requirements.txt (use pyproject.toml + uv)
- Pip/venv (use uv)

### Future Considerations
- Keep options open for Coolify/CapRover deployment
- Design for easy VPS migration
- Consider adding Caddy for HTTPS in v1
- May add Anthropic in v1, but OpenAI-only for v0

## Quick Command Reference

### Development

```bash
# Backend
cd backend
uv sync                          # Install/sync dependencies
uv run uvicorn main:app --reload # Run dev server with hot reload
uv run uvicorn main:app --host 0.0.0.0 --port 8000  # Run on specific host/port

# Linting and Type Checking
uv run ruff check .              # Lint code
uv run ruff check . --fix        # Auto-fix linting issues
uv run ruff format .             # Format code
uvx ty check                     # Type check with ty (Astral's type checker)

# Frontend
cd frontend
npm install                      # Install dependencies
npm run dev                      # Run dev server (http://localhost:5173)
npm run build                    # Build for production
npm run preview                  # Preview production build

# Full Stack Development
# Terminal 1: cd backend && uv run uvicorn main:app --reload
# Terminal 2: cd frontend && npm run dev
# Access: http://localhost:5173 (Vite proxies /api to backend)

# Pre-commit checks (run before committing)
cd backend && uv run ruff check . --fix && uv run ruff format . && uvx ty check
```

### Production

```bash
# Build and run single container
docker build -t llm-router .
docker run -p 8000:8000 --env-file .env llm-router

# Or use docker-compose
docker-compose up -d              # Start services
docker-compose logs -f            # View logs
docker-compose down               # Stop services

# Raspberry Pi (ARM64)
docker-compose -f docker-compose.yml -f docker-compose.pi.yml up -d
```

### Testing

```bash
# Backend health check
curl http://localhost:8000/health

# List conversations
curl http://localhost:8000/api/conversations

# Get models
curl http://localhost:8000/api/usage/models

# Backend tests (when implemented)
cd backend
uv run pytest

# Frontend tests (when implemented)
cd frontend
npm test
```

## Project Structure

```
llm-router/
├── backend/                    # Python FastAPI backend
│   ├── pyproject.toml         # Python dependencies (uv)
│   ├── main.py                # FastAPI app entry + static serving
│   ├── config.py              # Settings, model configs
│   ├── database.py            # SQLAlchemy models
│   ├── models.py              # Pydantic schemas
│   ├── routers/               # API route handlers
│   │   ├── chat.py           # SSE streaming endpoint
│   │   ├── conversations.py  # CRUD endpoints
│   │   └── usage.py          # Usage stats endpoints
│   └── services/              # Business logic
│       ├── llm_client.py     # OpenAI/Anthropic client
│       └── usage_tracker.py  # Token counting, costs
├── frontend/                   # Vanilla TypeScript + Vite
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.ts            # Entry point
│       ├── types.ts           # TypeScript definitions
│       ├── api.ts             # Backend API client
│       ├── components/        # UI components
│       ├── state/             # Reactive state
│       └── styles/            # CSS
├── Dockerfile                  # Single-container build
├── docker-compose.yml          # Deployment config
├── .env                        # API keys (gitignored)
└── data/                       # SQLite database (gitignored)
```

## Architecture

### Backend (Python FastAPI)

**Key Components:**

1. **main.py** - FastAPI application
   - Lifespan: Database initialization
   - CORS middleware for dev
   - Static file serving for production
   - Health check endpoint

2. **database.py** - SQLAlchemy async models
   - Conversation: Chat sessions
   - Message: Individual messages
   - UsageLog: Token usage tracking
   - Uses aiosqlite for async SQLite

3. **routers/chat.py** - SSE streaming endpoint
   - `POST /api/chat/stream`
   - Accepts message, model, optional conversation_id
   - Streams tokens via Server-Sent Events
   - Calculates tokens/cost, logs usage

4. **services/llm_client.py** - LLM API abstraction
   - Unified interface for OpenAI (and Anthropic in v1)
   - Async streaming support
   - Token counting with tiktoken

5. **config.py** - Configuration management
   - Environment variables (pydantic-settings)
   - Model pricing configuration
   - Provider mappings

**Database Schema:**

```sql
conversations (id, title, model, created_at, updated_at)
messages (id, conversation_id, role, content, model, tokens_input, tokens_output, cost, created_at)
usage_logs (id, conversation_id, model, provider, tokens_input, tokens_output, cost, timestamp)
```

**API Endpoints:**

- `POST /api/chat/stream` - Stream chat (SSE)
- `GET /api/conversations` - List conversations
- `GET /api/conversations/{id}` - Get conversation with messages
- `POST /api/conversations` - Create conversation
- `DELETE /api/conversations/{id}` - Delete conversation
- `POST /api/conversations/{id}/clone` - Clone conversation
- `GET /api/usage/summary` - Usage statistics
- `GET /api/usage/models` - Available models
- `GET /health` - Health check

### Frontend (Vanilla TypeScript)

**Key Components:**

1. **main.ts** - Application initialization
   - Creates ChatInterface
   - Mounts to DOM

2. **state/store.ts** - Reactive state management
   - Proxy-based reactivity
   - Pub/sub pattern for updates
   - LocalStorage for selectedModel

3. **api.ts** - Backend communication
   - Fetch wrappers for REST endpoints
   - SSE client for streaming
   - Error handling

4. **components/** - UI components
   - **ChatInterface.ts** - Main app container
   - **MessageList.ts** - Message rendering with markdown
   - **MessageInput.ts** - Textarea with auto-grow
   - **ModelSelector.ts** - Model dropdown
   - **Sidebar.ts** - Conversation list

**State Flow:**

```
User Action → Component Handler → Store Action → State Update → Notify Subscribers → Re-render
```

**Streaming Flow:**

```
User sends message → POST /api/chat/stream
                  → Receives SSE events
                  → "token" events: append to message
                  → "done" event: finalize, reload conversation
                  → "error" event: show error
```

## Development Workflow

### Adding a New Model

1. Update `backend/config.py`:
   ```python
   MODELS = {
       "openai": {
           "new-model": {
               "name": "Display Name",
               "input_cost": 0.001,
               "output_cost": 0.002,
           }
       }
   }
   ```

2. No frontend changes needed - models are fetched dynamically

### Adding a New API Endpoint

1. Create router in `backend/routers/`
2. Add Pydantic models in `backend/models.py`
3. Include router in `backend/main.py`:
   ```python
   from routers import new_router
   app.include_router(new_router.router)
   ```
4. Add client function in `frontend/src/api.ts`
5. Call from components

### Modifying Database Schema

1. Update models in `backend/database.py`
2. For production, use Alembic migrations (not yet implemented)
3. For dev, delete `data/llm-router.db` and restart

### Adding a New UI Component

1. Create TypeScript file in `frontend/src/components/`
2. Export function that returns HTMLElement
3. Subscribe to store for reactive updates
4. Import and use in parent component

## Environment Variables

Required:
- `OPENAI_API_KEY` - OpenAI API key

Optional:
- `ANTHROPIC_API_KEY` - Anthropic API key (v1)
- `DATABASE_PATH` - SQLite database path (default: `./data/llm-router.db`)

## Deployment

### Docker Single Container

The Dockerfile uses multi-stage build:

1. **Stage 1 (frontend-builder)**: Builds frontend with Node
2. **Stage 2 (backend)**: Python runtime + backend code + static files from stage 1

FastAPI serves both API (`/api/*`) and static files (`/`).

### Docker Compose

Services:
- `llm-router`: Single container exposing port 8000

Volumes:
- `./data:/app/data` - Persist SQLite database

### Platform-Specific

- **Raspberry Pi**: Use `docker-compose.pi.yml` override for ARM64 images
- **VPS**: Same as Pi, optionally add Caddy for HTTPS
- **Local Dev**: Run backend + frontend separately for hot reload

## Debugging

### Backend Issues

```bash
# Check logs
docker-compose logs -f llm-router

# Access container
docker-compose exec llm-router /bin/sh

# Check database
cd backend
uv run python -c "from database import engine; print(engine.url)"

# Verify API keys
cd backend
uv run python -c "from config import settings; print(settings.openai_api_key[:10])"
```

### Frontend Issues

```bash
# Check Vite dev server
cd frontend
npm run dev -- --debug

# Build and check for errors
npm run build

# Clear cache
rm -rf node_modules dist
npm install
npm run build
```

### SSE Streaming Issues

- Chrome DevTools → Network → Check EventStream connections
- Look for `text/event-stream` content type
- Check CORS headers if using dev server

### Database Issues

```bash
# Inspect database
cd data
sqlite3 llm-router.db
.tables
.schema conversations
SELECT * FROM conversations;
```

## Testing Strategy

### Unit Tests (TODO)

- Backend: pytest with async support
- Frontend: Vitest for component logic

### Integration Tests (TODO)

- Test SSE streaming end-to-end
- Test conversation CRUD operations
- Test usage tracking accuracy

### Manual Testing

1. Start backend and frontend
2. Send a message (new conversation)
3. Verify streaming response
4. Check conversation saved
5. Switch models, send another message
6. Clone conversation
7. Delete conversation
8. Check usage stats

## Performance Optimization

### Backend

- SQLite async via aiosqlite
- FastAPI async endpoints
- Streaming reduces memory usage
- Connection pooling for DB

### Frontend

- Vanilla JS (no framework overhead)
- Vite for fast builds
- Code splitting (TODO)
- Lazy load highlight.js languages (TODO)

### Docker

- Multi-stage build reduces image size
- Alpine-based images where possible
- Layer caching optimized

## Security Considerations

- API keys in environment variables (not committed)
- No auth in v0 (rely on network security)
- SQLite file permissions
- CORS restricted to localhost in dev
- No XSS (markdown sanitization via marked.js)

## Future Enhancements

### v1
- Anthropic/Claude support
- Conversation search
- System prompts
- Export conversations
- Dark mode
- Image/vision support

### v2
- Multi-user with auth
- Usage analytics dashboard
- Local models (Ollama)
- PWA support
- Voice input

## Troubleshooting

### "Module not found" errors
- Backend: Check imports use relative paths (not `backend.module`)
- Frontend: Check `tsconfig.json` paths

### Database locked
- Only one writer at a time with SQLite
- Check for hung connections
- Restart backend

### Port conflicts
- Backend: Check port 8000 not in use
- Frontend: Check port 5173 not in use
- Change in `vite.config.ts` or uvicorn command

### Streaming not working
- Check EventSource browser support
- Verify CORS headers
- Check backend logs for errors

### Docker build fails
- Clear cache: `docker system prune -a`
- Check .dockerignore
- Verify all files committed

## Contributing

When making changes:

1. Test locally (backend + frontend dev servers)
2. Run builds: `npm run build` and `docker build`
3. Update this file if architecture changes
4. Update README.md if user commands change
5. Add entries to SPEC.md for major features

## License

MIT - See LICENSE file
