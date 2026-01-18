# LLM Router

A lightweight, self-hosted chat interface for routing queries through personal API keys. Built for privacy, simplicity, and full control over your LLM usage, with a retro terminal-inspired, mobile-first UI.

## Features

- **Retro terminal-inspired, aesthetic UI** built mobile-first
- **Multiple LLM providers** - OpenAI and Anthropic with dynamic model catalog
- **Background processing** - Submit a request and return later to the result
- **Realtime streaming when active** - Stream responses while the UI is open
- **Slash commands** - `/model`, `/temp`, `/reasoning`, `/system`, `/image`, `/help`
- **Conversation management** - Create, view, delete, and clone conversations
- **Usage tracking** - Track token usage and costs per model (device + overall)
- **Image generation** - `/image` for DALL-E and gpt-image
- **Single container deployment** - One command to run everything
- **Portable** - Works identically on Raspberry Pi 5 and VPS

## Quick Start

### Prerequisites

- **Development**: [uv](https://github.com/astral-sh/uv) for Python, Node 18+ for frontend
- **Production**: Docker and Docker Compose
- **Required**: OpenAI API key

### Development (Local)

```bash
# 1. Setup
cp .env.example .env
nano .env  # Add your OPENAI_API_KEY

# 2. Backend (Terminal 1)
cd backend
uv sync                         # Install dependencies
uv run uvicorn main:app --reload

# 3. Frontend (Terminal 2)
cd frontend
npm install
npm run dev

# 4. Open http://localhost:5173
```

**Quick commands:**
```bash
# Backend
cd backend && uv sync && uv run uvicorn main:app --reload

# Frontend
cd frontend && npm install && npm run dev

# Lint & type check (before committing)
cd backend && uv run ruff check . --fix && uvx ty check
```

### Production (Pi 5 / VPS)

1. **Clone and configure**
   ```bash
   git clone <your-repo-url> llm-router
   cd llm-router
   cp .env.example .env
   nano .env  # Add your API keys
   ```

2. **Deploy**
   ```bash
   docker-compose up -d
   ```

### Docker Compose (Git build examples)

Use these as a starting point in your homelab `docker-compose.yml` to build directly from a tag or branch:

```yaml
services:
  llm:
    build: https://github.com/gianlucatruda/llm-router.git#v0.2
    container_name: llm
    networks:
      - lan_net
      - wan_net
    env_file:
      - .secrets/llm # OPENAI_API_KEY and ANTHROPIC_API_KEY
    environment:
      - DATABASE_PATH=./data/llm-router.db
    volumes:
      - ${HOMELAB_DATA_DIR}/llm:/app/data
    restart: unless-stopped

  llm-dev:
    build: https://github.com/gianlucatruda/llm-router.git#dev
    container_name: llm-dev
    networks:
      - lan_net
      - wan_net
    env_file:
      - .secrets/llm-dev # OPENAI_API_KEY and ANTHROPIC_API_KEY
    environment:
      - DATABASE_PATH=./data/llm-router.db
    volumes:
      - ${HOMELAB_DATA_DIR}/llm-dev:/app/data
    restart: unless-stopped

networks:
  lan_net:
    external: true
  wan_net:
    external: true
```

Note: the Dockerfile installs backend deps via `uv sync` using `backend/pyproject.toml` + `backend/uv.lock`.

3. **Access**
   - http://your-pi-ip:8000
   - http://your-vps-ip:8000

4. **View logs**
   ```bash
   docker-compose logs -f
   ```

5. **Stop**
   ```bash
   docker-compose down
   ```

## Configuration

### Environment Variables

Edit `.env`:

```bash
# Required
OPENAI_API_KEY=sk-proj-...

# Optional (for v0.2+)
ANTHROPIC_API_KEY=sk-ant-...

# Database path (default: ./data/llm-router.db)
DATABASE_PATH=./data/llm-router.db
```

### Supported Models

Models are fetched dynamically from OpenAI and Anthropic when available, with a fallback list for offline or unsupported keys.

### Slash Commands

- `/help` - Show available commands and tips
- `/model <name|id>` - Switch model (autocomplete available)
- `/temp <0-2>` - Set temperature (only for supported models)
- `/reasoning <low|medium|high>` - Set reasoning level (only for supported models)
- `/system <text>` - Append to the per-conversation system prompt
- `/image <prompt> [model=...] [size=...]` - Generate an image (OpenAI only)

## Architecture

### Tech Stack

- **Backend**: Python FastAPI with async SQLite
- **Frontend**: Vanilla TypeScript + Vite
- **Database**: SQLite (single file)
- **Streaming**: Server-Sent Events (SSE)
- **Container**: Single Docker image with frontend + backend

### Project Structure

```
llm-router/
├── backend/           # FastAPI application
│   ├── main.py       # App entry + static serving
│   ├── config.py     # Settings and model configs
│   ├── database.py   # SQLAlchemy models
│   ├── models.py     # Pydantic schemas
│   ├── routers/      # API endpoints
│   └── services/     # LLM client, usage tracking
├── frontend/         # Vanilla TS frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── state/       # Reactive state
│   │   ├── styles/      # CSS
│   │   └── main.ts      # Entry point
│   └── index.html
└── Dockerfile        # Single-container build
```

## API Endpoints

### Chat

- `POST /api/chat/stream` - Stream chat completion (SSE)
- `POST /api/chat/submit` - Background chat completion

### Conversations

- `GET /api/conversations` - List all conversations
- `GET /api/conversations/{id}` - Get conversation with messages
- `POST /api/conversations` - Create new conversation
- `DELETE /api/conversations/{id}` - Delete conversation
- `POST /api/conversations/{id}/clone` - Clone conversation

### Usage

- `GET /api/usage/summary` - Get usage statistics
- `GET /api/usage/models` - List available models

### Images

- `POST /api/images/generate` - Generate an image from a prompt

## Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Building Docker Image

```bash
docker build -t llm-router .
```

### Testing Docker Locally

```bash
docker run -p 8000:8000 --env-file .env llm-router
```

## Roadmap

### v0.2 (Current)
- ✅ OpenAI + Anthropic integration
- ✅ Streaming responses + background processing
- ✅ Slash commands and per-conversation system prompts
- ✅ Image generation (/image)
- ✅ Usage tracking (device + overall)
- ✅ Retro terminal-inspired, mobile-first UI
- ✅ Single-container deployment

### v0.3 (Planned)
- [ ] Conversation search
- [ ] Export conversations (JSON, Markdown)
- [ ] Dark mode toggle
- [ ] Usage analytics dashboard
- [ ] Multi-user support (optional)
- [ ] Local model support (Ollama)
- [ ] PWA for mobile install
- [ ] HTTPS via Caddy

## Troubleshooting

### Backend won't start

**Check Python version**:
```bash
python --version  # Should be 3.11+
```

**Check dependencies**:
```bash
cd backend
uv sync
```

**Check .env file**:
```bash
cat .env  # Verify OPENAI_API_KEY is set
```

### Frontend shows errors

**Check Node version**:
```bash
node --version  # Should be 18+
```

**Rebuild**:
```bash
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### Docker build fails

**Check Docker version**:
```bash
docker --version
docker-compose --version
```

**Clean build**:
```bash
docker-compose down
docker system prune -a
docker-compose build --no-cache
```

### Can't connect to backend

**Check ports**:
```bash
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows
```

**Check firewall** (on Pi/VPS):
```bash
sudo ufw allow 8000
```

## Contributing

This is a personal project, but suggestions and bug reports are welcome via issues.

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Inspired by ChatGPT's interface
- Built with FastAPI, TypeScript, and Docker
- Uses OpenAI and Anthropic APIs
