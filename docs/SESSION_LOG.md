# Session Log

Purpose: capture decisions, test runs, issues, and fixes so work can resume cleanly.

## 2026-02-01
- Started UX/test iteration loop plan; created this log.
- Added Playwright smoke scripts: `scripts/ux-smoke.js`, `scripts/ux-extended.js`, `scripts/api-smoke.js`.
- Screenshots saved to `docs/screenshots/` (timestamped).
- Added clone action in sessions panel and retro CRT styling pass.
- Persisted last active conversation on refresh.

### Test Runs
- `node scripts/api-smoke.js`: health OK, 3 models, conversations list OK, usage summary OK.
- `node scripts/ux-smoke.js`: messages streamed, code block rendering OK, refresh persistence OK, screenshots taken (mobile/tablet/desktop).
- `node scripts/ux-extended.js`: poetry prompt OK, clone OK, refresh persistence OK.

## 2026-02-01 (later)
### Test Runs
- `node scripts/api-smoke.js`: health OK, models OK, usage summary OK.
- `node scripts/ux-smoke.js`: streamed content OK, code blocks OK, refresh persistence OK; screenshots updated.
- `node scripts/ux-extended.js`: poetry prompt OK, clone OK, refresh persistence OK.

### Screenshots
- Latest set in `docs/screenshots/`:
  - `2026-01-17T17-10-20-456Z-desktop.png`
  - `2026-01-17T17-10-20-456Z-tablet.png`
  - `2026-01-17T17-10-29-109Z-sessions-after-poetry.png`
  - `2026-01-17T17-10-29-109Z-after-clone.png`

## 2026-02-01 (v1 build pass)
### Changes
- Added dynamic model catalog with fallback metadata + defaults.
- Added device-scoped usage tracking and stats (cookie-based).
- Added slash commands with autocomplete and `/help`.
- Added message copy buttons and stats panel.
- Shifted UI to Tokyo Night + Ubuntu Mono Nerd Font TUI styling.

### Issues & Fixes
- Issue: Vite proxy resolved localhost to IPv6 (::1), backend bound to 127.0.0.1; API calls failed.
  - Fix: set proxy targets to `http://127.0.0.1:8000` in `frontend/vite.config.ts`.

### Test Runs
- `node scripts/api-smoke.js`: models catalog OK (defaults gpt-5.1/low), usage OK.
- `node scripts/ux-smoke.js`: slash commands OK, streaming OK, code blocks OK, refresh persistence OK.
- `node scripts/ux-extended.js`: clone OK, refresh persistence OK.

### Issues & Fixes (follow-up)
- OpenAI responses API required `input_text` content type; fixed in `backend/services/llm_client.py`.
- Streaming failed due to misplaced `get_completion_metadata`; moved back into `LLMClient`.
- Vite proxy IPv6 localhost issue fixed earlier.

### Test Runs (follow-up)
- `node scripts/ux-smoke.js`: streaming OK after responses fix, screenshots updated.

## 2026-02-01 (manual validation pass)
### Test Runs
- `node scripts/ux-manual.js`: slash command suggestions OK, model switch OK, reasoning rejection on non-supporting model OK, input stays enabled during streaming, metadata persists after reload.

### Screenshots
- Latest manual flow in `docs/screenshots/`:
  - `2026-01-17T18-28-42-034Z-start.png`
  - `2026-01-17T18-28-42-034Z-after-gpt-5-1.png`
  - `2026-01-17T18-28-42-034Z-after-gpt-4o.png`
  - `2026-01-17T18-28-42-034Z-after-long-thread.png`
  - `2026-01-17T18-28-42-034Z-after-reload.png`

## 2026-02-01 (v2 testing pass)
### Issues
- Anthropic model `claude-3-5-sonnet-20240620` returns 404 on current key; shown as error in UI meta.
  - Catalog now marks non-live models as `available=false` and UI shows `unverified`.

### Test Runs
- `node scripts/ux-matrix.js`: OpenAI models OK; Anthropic sonnet fails on current key (expected).
- `node scripts/image-smoke.js`: OpenAI image generation OK (DALL·E 3).
- `node scripts/ux-smoke.js`: submit/poll flow OK after fixes.
- `node scripts/ux-smoke.js`: spacing adjustments verified across mobile/tablet/desktop.
- `node scripts/ux-matrix.js`: Anthropic system prompt role handling fixed; sonnet still unavailable on current key.

### Issues & Fixes
- Issue: sessions close button not always visible for automated click; updated test to close overlay safely.
- Issue: last conversation not restored on refresh; fixed by storing `currentConversationId` and restoring on load.
