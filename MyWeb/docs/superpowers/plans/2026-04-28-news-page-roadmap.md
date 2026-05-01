# News Page Roadmap

## Goal

Build a news experience that can:

- browse news by topic
- filter by source
- manage source configuration from Settings
- pull real feed data from supported sources
- support an LLM chat workflow for asking questions about the news

## Current State: Full-Stack MVP

Frontend fetches real articles from the backend via API. Source management is admin-only in Settings.
Backend fetches and parses RSS feeds, stores articles in SQLite, and serves them via REST API.

### What's Working

- Topic tabs, source filter, article list with clickable links
- Refresh button to fetch new articles from RSS feeds
- Loading, empty, and error states
- Admin-only source CRUD (add, enable/disable, delete) in Settings
- Backend RSS fetching via feedparser, article deduplication by URL
- JWT auth on all endpoints, admin_required on source mutations

### Remaining Gaps

- No curated default source list (users start with zero sources)
- No pagination UI (backend supports offset/limit but frontend doesn't use it yet)
- No text search / keyword filter
- No article detail view

## Product Shape

### News Page

The news page should stay focused on reading and browsing:

- topic tabs
- source filter
- article list
- article detail or summary view later

The news page should not be the place for heavy configuration.

### Settings Page

The Settings page should own source management:

- list all configured sources
- add a source
- enable / disable a source
- edit or remove a source

## Roadmap

### Phase 1: Source Management in Settings (Done)

- [x] Move source list + add/edit/delete UI into SettingsPage
- [x] Strip NewsPage down to topic tabs + source filter + article list only
- [x] Reuse the same `NewsSource` type in both pages (shared `sources.ts` module)
- [x] Add source deletion capability (with confirmation dialog)

### Phase 2: Backend RSS Infrastructure (Done)

- [x] Add `news_sources` and `news_articles` tables (lazy via store.py `_ensure_tables()`)
- [x] Add `feedparser>=6.0` to `pyproject.toml`
- [x] Create `src/services/news/` (service, store, models, errors)
- [x] Create `src/gateway/routes/news.py` with endpoints:
  - `GET /api/news/sources` — list user's sources
  - `POST /api/news/sources` — add source
  - `PUT /api/news/sources/{id}` — update (enable/disable)
  - `DELETE /api/news/sources/{id}` — remove source
  - `GET /api/news/articles` — list articles (filter by topic/source)
  - `POST /api/news/refresh` — trigger feed refresh
- [x] Register news router in `__main__.py`
- [x] Add JWT auth to all news endpoints
- [x] Create frontend API client (`src/api/news.ts`)

### Phase 3: Frontend Integration (Done)

- [x] Replace localStorage source management with API calls in SettingsPage
- [x] Replace mock `NEWS_ITEMS` with real API-fetched articles in NewsPage
- [x] Add loading, empty, and error states
- [x] Add refresh button to trigger feed fetch
- [x] Add article titles as clickable links to source URLs
- [x] Admin-only source management (backend: `admin_required`, frontend: `isAdmin()` guard)

### Phase 4: Curated Source List (Done)

- [x] Updated topics: Tech, Music, World, US News, Hip Hop, Gaming
- [x] Built curated default source list (21 sources) — neutral, non-partisan outlets
- [x] Added `POST /api/news/sources/seed` endpoint (admin-only) to insert defaults
- [x] Added "Load defaults" button in Settings UI
- [x] Deduplication by feed URL — safe to run multiple times

### Phase 5: LLM News Chat

- [ ] Add chat entry point on news page
- [ ] Support prompts like "Summarize today's business news"
- [ ] Ground answers in fetched articles, not model memory
- [ ] Decide UI: inline panel, separate page, or reuse existing chat

## Normalized Article Shape

```
id, title, source, topic, url, published_at, summary
```

## Open Questions

1. ~~Should sources be per-user (backend) or device-local (localStorage)?~~ — Resolved: per-user in backend
2. Should sources support non-RSS types (search APIs, scraping)?
   — Recommendation: RSS-only for now
3. Should LLM chat operate on filtered articles, all articles, or a saved selection?
4. How should the curated source list be seeded — admin adds them manually, or auto-seed on first deploy?

## Architecture Reference

```
Backend:
  src/services/news/service.py    — NewsService (business logic)
  src/services/news/store.py      — NewsStore (database access)
  src/services/news/models.py     — Pydantic request/response models
  src/services/news/errors.py     — NewsServiceError types
  src/gateway/routes/news.py      — FastAPI router

Frontend:
  src/api/news.ts                 — API client (apiFetch wrapper)
  src/tools/news/NewsPage.tsx     — Read/browse UI
  src/tools/SettingsPage.tsx      — Source management UI
```

## Recommended Next Step

Phase 4 — build a curated list of quality RSS sources across all four topics so the news page is useful out of the box.
