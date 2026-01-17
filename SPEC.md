# LLM Router - Self-Hosted Chat Interface

## Project Overview

A retro terminal-inspired, mobile-first web application that routes queries through personal API keys (OpenAI, Anthropic, etc.). Designed for self-hosting on Raspberry Pi 5 with Docker Compose, with easy portability to VPS.

## v1 Requirements (Working Spec)

### Visual + UX
- Modern, clean terminal aesthetic inspired by Tokyo Night + Ubuntu Mono Nerd Font + Claude-cost TUI.
- Preserve rich text formatting (bold/italic/code), but style like a TUI.
- Mobile-first; touch-friendly controls; copy buttons on each message.

### Models + Controls
- Models fetched dynamically when possible; fallback to hardcoded list, clearly marked in UI.
- Include OpenAI + Anthropic catalogs with reasoning models (o1/o3), GPT-5.x, Claude Sonnet 4.5.
- Default: GPT-5.1 with low reasoning.
- Slash commands with autocomplete:
  - `/model <name>`
  - `/temp <number>`
  - `/reasoning <level>`
  - `/help`
- Command definitions centralized in one location for easy updates.

### Statistics
- Show per-session stats (tokens + cost est.).
- Show overall stats (tokens + cost est.).
- Persistence is device-scoped (survives refresh, even if localStorage cleared).

## v2 Requirements (Working Spec)

### Background Processing
- Submit requests to the backend, return immediately with a pending message.
- Process in background so responses complete even if device is offline.
- Resume by polling when the UI is reopened.
- Device/session identity via localStorage (cookie fallback).

### Commands + Media
- `/system` to append per-conversation system text.
- `/image` for OpenAI image generation (DALL·E 2/3, gpt-image-1).

### Deployment
- Docker Compose must be simple and robust for homelab usage (few-line add-on in existing compose).

## Core Requirements

### Must Have
- **Retro terminal-inspired, aesthetic UI** built mobile-first
- **Multi-provider support**: OpenAI and Anthropic APIs
- **Model selection**: Switch between models (GPT-4, GPT-3.5, Claude Opus, Claude Sonnet, etc.)
- **Conversation management**: Create, save, delete, search conversations
- **Session branching/cloning**: Fork conversations at any point
- **Usage tracking**: Token usage, costs, request logs
- **Docker Compose deployment**: Single-command setup
- **API key management**: Secure storage of multiple provider keys
- **Authentication**: Basic auth to protect self-hosted instance

### Nice to Have
- **Streaming responses**: Real-time token streaming like ChatGPT
- **Markdown rendering**: Proper code blocks, syntax highlighting
- **Export conversations**: JSON, Markdown, PDF
- **Usage analytics dashboard**: Graphs, trends, cost analysis
- **Multiple user support**: If hosting for family/friends
- **Prompt templates/library**: Saved prompts
- **System prompts**: Custom system messages per conversation
- **Image support**: For models that support vision (GPT-4V, Claude)
- **Conversation search**: Full-text search across all chats
- **Dark mode**: Theme toggle

## Architecture Options

### Option A: Lightweight Stack (Recommended for Pi 5)
**Frontend**: Vanilla JS or lightweight framework (Preact, Alpine.js)
**Backend**: Python FastAPI or Go
**Database**: SQLite
**Pros**: Minimal resource usage, fast on ARM, simple deployment
**Cons**: May need to upgrade for heavy multi-user usage

### Option B: Modern Full-Stack
**Frontend**: React/Next.js or Vue/Nuxt
**Backend**: Node.js (Express) or Python (FastAPI)
**Database**: PostgreSQL
**Pros**: Rich ecosystem, easier to find examples, better for scaling
**Cons**: Higher resource usage on Pi

### Option C: All-in-One Framework
**Stack**: SvelteKit or Next.js (full-stack)
**Database**: SQLite or PostgreSQL
**Pros**: Unified codebase, built-in SSR, API routes
**Cons**: More opinionated, potentially heavier

## Recommended Tech Stack (Balanced Approach)

### Frontend
- **Framework**: SvelteKit or Next.js
  - Mobile-first responsive design
  - Progressive Web App (PWA) support for "app-like" feel on mobile
- **UI Library**: Tailwind CSS + shadcn/ui or DaisyUI
- **State Management**: Built-in framework stores
- **Markdown**: marked.js + highlight.js for code

### Backend
- **Runtime**: Node.js 20+ or Python 3.11+
- **Framework**:
  - Node: Express or Fastify
  - Python: FastAPI
- **API Clients**: Official OpenAI and Anthropic SDKs
- **WebSocket**: For streaming responses

### Database
- **Primary**: PostgreSQL (easily swappable with SQLite for lighter setup)
- **Schema**:
  ```
  users (id, username, password_hash, created_at)
  conversations (id, user_id, title, created_at, updated_at)
  messages (id, conversation_id, role, content, model, tokens, cost, created_at)
  api_keys (id, user_id, provider, key_encrypted, created_at)
  usage_logs (id, user_id, provider, model, tokens, cost, timestamp)
  ```

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Traefik or Caddy (handles HTTPS, auto-renewal)
- **Secrets Management**: Docker secrets or .env with proper permissions

## System Design

### High-Level Architecture
```
[Mobile Browser]
    ↓ HTTPS
[Caddy/Traefik Reverse Proxy]
    ↓
[Frontend Container (Nginx/Node)]
    ↓ API Calls
[Backend Container (Node/Python)]
    ↓ Queries
[Database Container (PostgreSQL)]

Backend also calls:
    → OpenAI API
    → Anthropic API
```

### API Endpoints (Backend)
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/register` - Register new user (optional)
- `GET /api/conversations` - List all conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id` - Get conversation with messages
- `POST /api/conversations/:id/messages` - Send new message (streaming)
- `POST /api/conversations/:id/clone` - Clone/branch conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `GET /api/models` - List available models
- `POST /api/settings/api-keys` - Store API key
- `GET /api/usage` - Get usage statistics
- `GET /api/usage/export` - Export usage data

### Message Flow
1. User types message in frontend
2. Frontend sends to backend via WebSocket or SSE
3. Backend:
   - Validates request
   - Loads conversation context
   - Calls appropriate LLM API (OpenAI/Anthropic)
   - Streams response back to frontend
   - Logs usage (tokens, cost) to database
4. Frontend displays streaming response

## Feature Details

### Model Selection
- Dropdown in chat interface to select model
- Per-conversation model setting (saved)
- Quick-switch between providers
- Display model capabilities (context length, pricing)

### Conversation Branching
- "Branch from here" button on any message
- Creates new conversation with history up to that point
- Original conversation remains unchanged
- Branch metadata (parent conversation, branch point)

### Usage Tracking
- Real-time token counting
- Cost calculation based on model pricing
- Dashboard with:
  - Daily/weekly/monthly usage charts
  - Cost breakdown by model/provider
  - Token usage over time
  - Most expensive conversations
- Export to CSV/JSON

### Security Considerations
- API keys encrypted at rest (Fernet, AES-256)
- HTTPS only (enforced by reverse proxy)
- Rate limiting to prevent abuse
- Session-based auth with HTTP-only cookies
- Environment variables for sensitive config
- No API keys in logs or error messages

## Deployment Strategy

### Docker Compose Structure
```yaml
services:
  frontend:
    # Nginx serving static build or Node for SSR
  backend:
    # API server
  database:
    # PostgreSQL
  reverse-proxy:
    # Caddy with auto HTTPS
```

### Portability Plan
1. **Configuration via environment variables**
   - Database connection strings
   - API URLs
   - Domain names
2. **Volume mounts for persistence**
   - Database data
   - Conversation exports
   - Logs
3. **Single docker-compose.yml** for both Pi and VPS
4. **Platform-specific overrides**
   - `docker-compose.pi.yml` for ARM-specific optimizations
   - `docker-compose.vps.yml` for production settings

### Raspberry Pi 5 Optimizations
- Use multi-stage Docker builds to reduce image size
- ARM64 base images
- SQLite option for lower memory usage
- Connection pooling limits
- Aggressive caching headers for static assets

## Development Phases

### Phase 1: MVP
- [ ] Basic chat interface (single conversation)
- [ ] OpenAI integration (GPT-3.5/4)
- [ ] Message streaming
- [ ] Conversation persistence
- [ ] Simple auth (single user)
- [ ] Docker Compose setup

### Phase 2: Core Features
- [ ] Anthropic integration (Claude)
- [ ] Model selection
- [ ] Multiple conversations
- [ ] Conversation history/search
- [ ] Basic usage tracking
- [ ] Session cloning/branching

### Phase 3: Polish
- [ ] Usage analytics dashboard
- [ ] Export functionality
- [ ] Multi-user support (optional)
- [ ] Prompt templates
- [ ] Mobile PWA optimization
- [ ] Dark mode

## Open Questions

1. **Single-user vs multi-user?**
   - Start single-user, add multi-user later?
   - Or build multi-user from start for future-proofing?

2. **Database choice?**
   - SQLite for simplicity on Pi?
   - PostgreSQL for better concurrency?

3. **Frontend framework?**
   - Next.js (popular, good docs, heavier)
   - SvelteKit (lighter, faster, less ecosystem)
   - Vanilla + Alpine.js (minimal, more work)

4. **Streaming implementation?**
   - Server-Sent Events (simpler)
   - WebSockets (more flexible)

5. **Authentication strategy?**
   - Simple username/password?
   - No auth (rely on network-level security)?
   - OAuth (overkill for self-hosted)?

6. **Image/vision support?**
   - Include from start or add later?
   - How to handle image uploads/storage?

7. **Backup strategy?**
   - Automated database backups?
   - Conversation export on delete?

## Cost Considerations

### Development Time Estimate
- MVP (Phase 1): ~2-3 days focused work
- Core Features (Phase 2): ~2-3 days
- Polish (Phase 3): ~1-2 days

### Runtime Costs
- Self-hosted: Only API usage costs
- API costs depend on usage:
  - GPT-4: ~$0.03/1K input tokens, ~$0.06/1K output
  - GPT-3.5: ~$0.0005/1K input, ~$0.0015/1K output
  - Claude Opus: ~$0.015/1K input, ~$0.075/1K output
  - Claude Sonnet: ~$0.003/1K input, ~$0.015/1K output

### Resource Usage (Estimated)
- **Raspberry Pi 5 (8GB)**: Should handle 1-5 concurrent users easily
- **Docker containers**: ~500MB-1GB total RAM
- **Storage**: ~100MB for app, database grows with usage (estimate 1MB per 100 messages)

## Success Metrics

- Deployment time: < 5 minutes with single command
- Response time: < 500ms for non-LLM operations
- Mobile-friendly: Works seamlessly on phone browser
- Cost tracking: 100% accurate token/cost logging
- Portability: Move from Pi to VPS in < 30 minutes

## References & Inspiration

- ChatGPT's interface and UX patterns
- OpenAI API documentation
- Anthropic API documentation
- Similar projects: ChatGPT-Next-Web, LibreChat, BetterChatGPT
