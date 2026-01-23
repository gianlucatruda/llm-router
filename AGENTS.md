# LLM Router - Developer Guide

Technical documentation for developers and AI agents working on this codebase.

## Agent Workflow Requirements

- Progress log: Record all progress in `LOG.txt` using append-only entries (add new entries at the top; never edit past entries).
- Log detail: Include decisions made, bugs encountered, libraries added, features implemented, tests added/run, user requirements added, issues fixed, and new issues detected, with references (issue numbers, file paths, commands).
- Branch: Work on fixes in the `dev` branch unless told otherwise. You may commit on branches other than `main` / `master`, but you may NEVER push and you may NEVER commit on `main`/`master`.
- Issue tracking: Only run read-only GitHub issue queries when explicitly instructed (e.g. `gh --repo gianlucatruda/llm-router issue list` and `gh --repo gianlucatruda/llm-router issue view <issue_number>`). NEVER create or modify issues. You can mark them as solved in `LOG.txt` for your benefit.
- Issue status: Maintain a running record of outstanding issues and their details within `LOG.txt` entries; update status as work progresses.
- Branch safety: NEVER switch branches. Assume the user places you on the correct branch (currently `dev`). You may commit on branches other than `main`/`master`, but you may NEVER push and you may NEVER commit on `main`/`master`.
- Permissions: Read-only `gh --repo gianlucatruda/llm-router ...` commands are approved. `uv sync` and `npm install` are approved. Costly smoke tests are allowed but should be run sparingly after lint/build pass.
- Continuous checks: MUST ALWAYS run linting, formatting, unit tests, and build checks continuously while developing (unless explicitly told not to).
- Completion gate: When a feature is believed complete, MUST ALWAYS run smoke, integration, e2e, and manual tests (unless explicitly told not to).
- Refinement loop: After tests pass, MUST ALWAYS simplify/refine code to remove redundancy/inelegance without changing functionality, then re-run lint/format/tests/build. Repeat this refinement loop at least 3x unless explicitly told otherwise.
- Logging: MUST ALWAYS append to `LOG.txt` after work; never skip the append-only log update.
- Autonomy: Always behave as a long-running, fully autonomous agent that does comprehensive testing, refactoring, and documentation for multi-feature work without supervision.

`LOG.txt` entry format example (append-only):

```
YYYY-MM-DD HH:MM - Short summary
- Issues: #123 Title (status), #124 Title (status)
- Changes: AGENTS.md (added workflow section)
- Tests: not run (reason)
- Notes: relevant context for handoff
```

## Permissions & Approvals (Codex/Sandbox)

- Escalated permissions are typically required for commands that write to `~/.cache` or need network access, including `uv sync`, `uv run ruff check .`, `uv run pytest`, `uvx ty check`, and `npm install`.
- Playwright UX scripts (`node scripts/ux-*.js`) may download browsers to `~/.cache/ms-playwright` and write screenshots to `docs/screenshots/`.
- API/image smoke scripts (`node scripts/api-smoke.js`, `node scripts/image-smoke.js`) require network access and valid `.env` API keys.
- Some git commands may need access to `~/.gitconfig` when running inside a sandboxed shell.

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
- **No auth in v0.2** - Security via network isolation first
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
- **Docs discipline** - Keep `SPEC.md` updated with decisions and completed work as you go; move deferred items into v3.

### UX/Test Automation (Codex Sessions)
- **Backend dev server**: run `uv sync` in `backend`, then `uv run uvicorn main:app --reload`
- **Frontend dev server**: run `npm install` in `frontend`, then `npm run dev`
- **Playwright UX smoke**: `node scripts/ux-smoke.js` (takes screenshots in `docs/screenshots/`)
- **Extended UX smoke**: `node scripts/ux-extended.js` (cloning + refresh persistence checks)
- **Model matrix UX**: `node scripts/ux-matrix.js` (model/reasoning combinations)
- **Manual UX helper**: `node scripts/ux-manual.js`
- **API smoke**: `node scripts/api-smoke.js`
- **Image smoke**: `node scripts/image-smoke.js`
- Use real API keys from `.env` for live testing (no mocks for v0.2)
- Avoid one-off test scripts for fixes; expand the automated suite instead to prevent regressions.

### Formatting & Checks (Run Often)
- **Backend format**: `cd backend && uv run ruff format .`
- **Backend type check**: `cd backend && uvx ty check`
- **Frontend build**: `cd frontend && npm run build`
- Reminder: run these frequently while developing and before claiming a feature is done.
- Note: in sandboxed runs, `uvx` may panic; rerun `uvx ty check` outside the sandbox if needed.

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
- Consider adding Caddy for HTTPS in v0.3
- Anthropic support is included in v0.2
