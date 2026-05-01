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

### Phase 5: Personal News Agent

A background agent that curates a personalized news feed.

**How it works:**

1. **Background scheduler** runs every few hours (configurable)
2. Fetches new articles from all enabled sources (RSS now, Twitter later)
3. LLM reads articles + user context to pick what matters most
4. Writes a short summary for each pick, keeps the original link
5. Saves picks to a `curated_articles` table
6. News page shows the curated feed — summarized stories with links

**User context the agent can access:**

- [ ] User interests / profile (explicit preferences)
- [ ] Calendar (upcoming meetings, events → topic relevance)
- [ ] Email (active threads, projects → what they're working on)
- [ ] Memories (stored facts about the user)
- [ ] Reading patterns (which topics/sources they engage with)

**Implementation:**

- [ ] Create `curated_articles` table (article_id, user_id, summary, relevance_score, link, created_at)
- [ ] Build news curation agent with tools: search_articles, get_calendar, get_recent_mail, get_memories
- [ ] Background scheduler (cron or async task) to run the agent periodically
- [ ] API endpoint: `GET /api/news/curated` — returns the personalized feed
- [ ] Frontend: show curated feed at top of news page, with summaries + links
- [ ] Settings: configure interests, schedule frequency, context access

### Phase 6: Twitter/X Integration

- [ ] Add Twitter/X as a source type alongside RSS
- [ ] Normalize tweets into the same article shape
- [ ] Support following accounts, hashtags, lists
- [ ] Feed into the same curation pipeline as RSS

### Phase 7: Interactive News Chat

- [ ] Inline chat on the news page
- [ ] "Summarize today's tech news"
- [ ] "What are the main themes across these sources?"
- [ ] "Tell me more about [article]"
- [ ] Grounded in fetched + curated articles

## Open Questions

1. ~~Should sources be per-user (backend) or device-local (localStorage)?~~ — Resolved: per-user in backend
2. ~~How should the curated source list be seeded?~~ — Resolved: both admin UI and seed endpoint
3. How often should the curation agent run? (every 2h? 4h? configurable?)
4. How much user context should the agent access by default vs opt-in?
5. Twitter API access — which API tier? User's own keys or shared?
6. Should the curated feed replace the raw feed, or sit alongside it?

## Architecture Reference

```
Backend:
  src/services/news/service.py    — NewsService (business logic)
  src/services/news/store.py      — NewsStore (database access)
  src/services/news/models.py     — Pydantic request/response models
  src/services/news/errors.py     — NewsServiceError types
  src/services/news/defaults.py   — Curated default source list
  src/gateway/routes/news.py      — FastAPI router

Frontend:
  src/api/news.ts                 — API client (apiFetch wrapper)
  src/tools/news/NewsPage.tsx     — Read/browse UI
  src/tools/news/sources.ts       — Shared types + topics
  src/tools/SettingsPage.tsx      — Source management UI (admin)
```

## Recommended Next Step

Phase 5 — build the personal news agent with background curation and user context access.
