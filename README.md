# LLM Router

A lightweight, self-hosted chat interface for routing queries through personal API keys. Built for privacy, simplicity, and full control over your LLM usage.

## Features

- **Mobile-first responsive UI** inspired by ChatGPT
- **Multiple LLM providers** - OpenAI (v0), Anthropic coming in v1
- **Real-time streaming** - Token-by-token responses via Server-Sent Events
- **Conversation management** - Create, view, delete, and clone conversations
- **Usage tracking** - Track token usage and costs per model
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
   # Standard deployment
   docker-compose up -d

   # For Raspberry Pi (ARM64)
   docker-compose -f docker-compose.yml -f docker-compose.pi.yml up -d
   ```

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

# Optional (for v1)
ANTHROPIC_API_KEY=sk-ant-...

# Database path (default: ./data/llm-router.db)
DATABASE_PATH=./data/llm-router.db
```

### Supported Models (v0)

| Model | Provider | Input Cost | Output Cost |
|-------|----------|------------|-------------|
| GPT-4o | OpenAI | $0.0025/1K | $0.01/1K |
| GPT-4 Turbo | OpenAI | $0.01/1K | $0.03/1K |
| GPT-3.5 Turbo | OpenAI | $0.0005/1K | $0.0015/1K |

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

### Conversations

- `GET /api/conversations` - List all conversations
- `GET /api/conversations/{id}` - Get conversation with messages
- `POST /api/conversations` - Create new conversation
- `DELETE /api/conversations/{id}` - Delete conversation
- `POST /api/conversations/{id}/clone` - Clone conversation

### Usage

- `GET /api/usage/summary` - Get usage statistics
- `GET /api/usage/models` - List available models

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

### v0 (Current)
- ✅ OpenAI integration
- ✅ Streaming responses
- ✅ Conversation management
- ✅ Usage tracking
- ✅ Mobile-first UI
- ✅ Single-container deployment

### v1 (Next)
- [ ] Anthropic/Claude support
- [ ] Conversation search
- [ ] Dark mode toggle
- [ ] Export conversations (JSON, Markdown)
- [ ] System prompts
- [ ] Image/vision support
- [ ] HTTPS via Caddy

### v2 (Future)
- [ ] Usage analytics dashboard
- [ ] Prompt templates
- [ ] Multi-user support (optional)
- [ ] Local model support (Ollama)
- [ ] PWA for mobile install

## Troubleshooting

### Backend won't start

**Check Python version**:
```bash
python --version  # Should be 3.11+
```

**Check dependencies**:
```bash
pip install -r backend/requirements.txt
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
