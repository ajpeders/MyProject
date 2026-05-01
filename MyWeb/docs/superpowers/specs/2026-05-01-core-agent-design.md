# Core Agent & Personal News Curation — Design Spec

## Overview

A personal agent system that knows the user — their interests, calendar, email, and memories — and uses that context to curate a personalized news feed and answer contextual questions. Built as a **User Profile Service + Specialist Agents** architecture.

## Goals

- Background agent curates a personalized news feed on a schedule
- User sets explicit interests; system also learns from behavior
- Agent has read access to mail, calendar, and memories for context
- Agent can take actions (create calendar events, save memories)
- Each service can use a different LLM model (configurable per user)
- Chat interface lets user ask contextual questions ("what should I focus on today?")
- Architecture supports future extensions (mail digest, daily brief, Twitter feeds)

## Architecture

```
UserProfile Service (no LLM — just data)
├── Interests (explicit keywords/topics)
├── Behavior signals (implicit — clicks, browses, engages)
├── Model config (per-service model overrides)
└── context_snapshot() → unified context for any agent

News Curator Agent (scheduled, background)
├── Consumes: profile context + recent articles
├── Produces: scored + summarized picks → curated_articles table
└── Model: user-configurable per service

Core Chat Agent (on-demand, interactive)
├── Tools: search_news, get_curated, get_calendar, get_mail_summary,
│          get_memories, get_profile, create_calendar_event, remember, answer
└── Model: user-configurable per service

Background Scheduler
├── Async loop in FastAPI process
├── Checks scheduled_tasks table every 60s
└── Runs overdue tasks (news curation, future: mail digest, daily brief)
```

## Component Details

### 1. User Profile Service

**Location:** `src/services/profile/`

**Purpose:** Stores what the user cares about and builds context snapshots for agents.

**Database — `user_profile` table:**

| Column | Type | Description |
|--------|------|-------------|
| user_id | TEXT PK | FK → users |
| interests | TEXT | JSON array of interest strings |
| model_config | TEXT | JSON dict of service → model name |
| updated_at | REAL | Last update timestamp |

**Database — `profile_signals` table:**

| Column | Type | Description |
|--------|------|-------------|
| signal_id | TEXT PK | UUID |
| user_id | TEXT | FK → users |
| signal_type | TEXT | "article_click", "topic_browse", "email_engage" |
| topic | TEXT | Topic or keyword associated with signal |
| source | TEXT | Where the signal came from |
| created_at | REAL | Timestamp |

**ProfileService methods:**

```python
class ProfileService:
    def get_interests(user_id: str) -> list[str]
    def set_interests(user_id: str, interests: list[str]) -> None
    def log_signal(user_id: str, signal_type: str, topic: str, source: str) -> None
    def get_model(user_id: str, service_name: str) -> str  # falls back to DEFAULT_MODEL
    def set_model_config(user_id: str, config: dict[str, str]) -> None
    def context_snapshot(user_id: str) -> ContextSnapshot
```

**ContextSnapshot model:**

```python
class ContextSnapshot(BaseModel):
    user_id: str
    interests: list[str]
    recent_signals: list[Signal]       # last 50 behavior signals
    calendar_today: list[CalendarEvent] # today's events
    calendar_upcoming: list[CalendarEvent] # next 3 days
    mail_subjects: list[str]           # recent 20 email subjects
    memories: list[str]                # top 10 relevant memories
```

The `context_snapshot()` method calls into CalendarService, MemoryService, and optionally MailService to build this object. It's the single entry point for any agent that needs user context.

**Mail access in background context:** Mail requires IMAP credentials which are normally decrypted from the JWT during a live request. For background tasks (scheduler), `context_snapshot()` gracefully degrades — `mail_subjects` returns empty when no session/credentials are available. Calendar and memories are local SQLite and always accessible. In the future, if mail context is needed in background tasks, stored encrypted credentials can be decrypted with a service key.

**API endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/profile | jwt | Get user's profile (interests, model config) |
| PUT | /api/profile/interests | jwt | Set interests |
| PUT | /api/profile/models | jwt | Set per-service model config |
| POST | /api/profile/signal | jwt | Log a behavior signal |

**Routes file:** `src/gateway/routes/profile.py`

### 2. News Curator Agent

**Location:** `src/services/news/curator.py`

**Purpose:** Background agent that reads articles, scores them against user context, and saves the best picks with summaries.

**Flow:**

1. Called by scheduler (or manually via API)
2. Gets `context_snapshot(user_id)` from profile service
3. Fetches uncurated articles via `LEFT JOIN curated_articles ON article_id WHERE curated_id IS NULL` — only articles not yet scored
4. Batches articles (20 per LLM call) with user context
5. LLM returns structured JSON: relevance score (0-1) + summary for each
6. Articles scoring above 0.5 saved to `curated_articles`
7. Updates last_run timestamp

**Database — `curated_articles` table:**

| Column | Type | Description |
|--------|------|-------------|
| curated_id | TEXT PK | UUID |
| user_id | TEXT | FK → users |
| article_id | TEXT | FK → news_articles |
| summary | TEXT | LLM-written 1-2 sentence summary |
| relevance_score | REAL | 0.0 to 1.0 |
| reason | TEXT | Why it was picked |
| created_at | REAL | Timestamp |

**LLM prompt strategy:**

System prompt:
```
You are a personal news curator. Given the user's interests, 
schedule, recent email topics, and stored knowledge, score each 
article's relevance from 0 to 1 and write a concise summary for 
anything above 0.5.

User context:
- Interests: {interests}
- Today's calendar: {calendar_today}
- Recent email topics: {mail_subjects}
- Key memories: {memories}
- Recent behavior: {recent_signals}
- Liked topics: {upvoted_topics}
- Disliked topics: {downvoted_topics}
- Preferred sources: {upvoted_sources}
- Deprioritized sources: {downvoted_sources}
```

Input (per batch):
```json
{"articles": [
  {"id": "...", "title": "...", "source": "...", "topic": "...", "summary": "..."},
  ...
]}
```

Expected output:
```json
{"results": [
  {"article_id": "...", "score": 0.85, "summary": "...", "reason": "Matches your interest in AI"},
  ...
]}
```

**NewsCurator class:**

```python
class NewsCurator:
    def __init__(self, profile: ProfileService, news: NewsService):
        ...
    
    async def curate(self, user_id: str) -> int:
        """Score and summarize articles. Returns count of new picks."""
        ...
```

**Model:** Retrieved via `profile.get_model(user_id, "news_curation")`. Falls back to system default.

**User feedback:**

Curated articles can be rated by the user (thumbs up/down). Ratings are logged as profile signals so the curator learns over time.

**Database — `curated_ratings` table:**

| Column | Type | Description |
|--------|------|-------------|
| rating_id | TEXT PK | UUID |
| user_id | TEXT | FK → users |
| curated_id | TEXT | FK → curated_articles, UNIQUE(user_id, curated_id) |
| rating | INTEGER | 1 = thumbs up, -1 = thumbs down |
| created_at | REAL | Timestamp |

When the user rates an article:
1. Save to `curated_ratings`
2. Log a `profile_signal` with `signal_type="curated_rating"`, the article's topic, and the rating
3. Future curation runs factor in these signals — upvoted topics get boosted, downvoted get suppressed

**Source preferences:**

Sources can also be rated. If a user consistently downvotes articles from a source, the curator deprioritizes it.

**Database — `source_ratings` table:**

| Column | Type | Description |
|--------|------|-------------|
| rating_id | TEXT PK | UUID |
| user_id | TEXT | FK → users |
| source_id | TEXT | FK → news_sources, UNIQUE(user_id, source_id) |
| rating | INTEGER | 1 = prefer, -1 = deprioritize |
| created_at | REAL | Timestamp |

**API endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/news/curated | jwt | Get user's curated feed |
| POST | /api/news/curate | admin | Manually trigger curation |
| POST | /api/news/curated/{id}/rate | jwt | Rate a curated article (1 or -1) |
| POST | /api/news/sources/{id}/rate | jwt | Rate a source (1 or -1) |

### 3. Background Scheduler

**Location:** `src/services/scheduler/`

**Purpose:** Runs curation tasks periodically within the FastAPI process.

**Database — `scheduled_tasks` table:**

| Column | Type | Description |
|--------|------|-------------|
| task_id | TEXT PK | UUID |
| user_id | TEXT | FK → users |
| task_type | TEXT | "news_curation", "mail_digest", "daily_brief" |
| schedule | TEXT | Interval like "4h", "2h", "24h" |
| last_run_at | REAL | Last execution timestamp |
| next_run_at | REAL | When to run next |
| enabled | INTEGER | 1 = active, 0 = paused |

**Runner (`runner.py`):**

```python
async def start_scheduler(app: FastAPI):
    """Start background loop. Called on app startup."""
    asyncio.create_task(_scheduler_loop())

async def _scheduler_loop():
    """Check for overdue tasks every 60 seconds."""
    while True:
        await asyncio.sleep(60)
        overdue = scheduler_store.get_overdue_tasks()
        for task in overdue:
            try:
                await _run_task(task)
                scheduler_store.mark_completed(task.task_id)
            except Exception:
                log.warning("Task %s failed", task.task_id, exc_info=True)
```

**Task dispatch:**
```python
TASK_HANDLERS = {
    "news_curation": lambda user_id: NewsCurator(...).curate(user_id),
    # future: "mail_digest", "daily_brief"
}
```

**API endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/schedule | jwt | List user's scheduled tasks |
| PUT | /api/schedule/{task_id} | jwt | Update schedule, enable/disable |

**Startup integration (using FastAPI lifespan):**
```python
# In __main__.py
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()

app = FastAPI(lifespan=lifespan)
```

### 4. Core Chat Agent

**Location:** `src/core/agents/core.py`

**Purpose:** Interactive agent the user can chat with. Has tools to access all data sources and take actions.

**Pattern:** Uses the existing `AgentDef` + `AgentExecutor` pattern. CoreAgent subclasses `AgentDef`, defines its scoped `CORE_TOOLS` list, and provides a `system_prompt()` method that injects the user's context snapshot. The executor runs the standard plan-then-execute loop — LLM returns a `Plan` with tool calls, executor dispatches them, feeds results back until the LLM returns a final `answer`.

**Tool set (CORE_TOOLS):**

| Tool | Params | Description |
|------|--------|-------------|
| search_news | query (str), topic (str), days (int) | Search articles by keyword/topic/recency |
| get_curated | count (int, default 10) | Get latest curated picks |
| get_calendar | days (int, default 3) | Get upcoming calendar events |
| get_mail_summary | count (int, default 20) | Get recent email subjects + senders |
| get_memories | query (str) | Semantic search over user memories |
| get_profile | — | Get user interests and recent signals |
| create_calendar_event | title, date, time, description | Add a calendar event |
| remember | content (str) | Save a fact to memory |
| answer | content (str) | Respond to user |
| done | — | End conversation |

**Routing from HeadAgent:**

Add `"core"` as a route option. Requires updating `src/core/agents/head.py`:
- Add `core` entry to `_AGENT_CONTEXT` dict with description of when to route there
- Update `_ROUTE_TOOL` param's agent description to include `"core"`

HeadAgent routes to CoreAgent when intent matches:
- Personal context queries ("what should I focus on today?")
- News-related questions ("what's happening in AI?")
- Cross-domain queries ("brief me before my 3pm meeting")
- Proactive requests ("remind me to check news about X")

**System prompt:**
```
You are the user's personal agent. You know their interests, 
schedule, email, and stored memories. Use your tools to answer 
questions grounded in real data — never guess or use stale info.

User profile:
{context_snapshot}
```

**Model:** Retrieved via `profile.get_model(user_id, "core_chat")`.

**Registration:**
```python
# src/core/agents/__init__.py
AGENTS = {
    "mail": MailAgent(),
    "command": CommandAgent(),
    "answer": AnswerAgent(),
    "core": CoreAgent(),  # new
}
```

### 5. Frontend Changes

**News page — "For You" tab:**
- "For You" is a UI-only tab, NOT added to `NewsTopic` type (it's a different data source, not a topic filter)
- Tab list in JSX becomes `["For You", ...TOPICS]` — `TOPICS` array stays unchanged
- When "For You" is active, NewsPage calls `GET /api/news/curated` instead of `GET /api/news/articles`
- Each curated item shows: summary, source, reason, link to original article
- Thumbs up / thumbs down buttons on each curated item
- Rating calls `POST /api/news/curated/{id}/rate` and logs a profile signal
- Empty state: "Set up your interests in Settings to get personalized picks"

**Settings page — "Profile" section:**
- Visible to all users (not admin-gated like source management)
- **Interests:** tag input — add/remove keywords
- **Models:** per-service model picker (dropdowns using available_models from mail config pattern)
- **Schedule:** toggle curation on/off, frequency dropdown (1h, 2h, 4h, 8h, 24h)

**New API client files:**
- `src/api/profile.ts` — getProfile, updateInterests, updateModelConfig, logSignal
- `src/api/schedule.ts` — getSchedule, updateSchedule

**Modified frontend files:**
- `src/tools/news/sources.ts` — add "For You" to NewsTopic type
- `src/tools/news/NewsPage.tsx` — add "For You" tab, call curated endpoint
- `src/tools/SettingsPage.tsx` — add Profile section

**Chat page:** No changes needed — HeadAgent routing handles it automatically.

## Build Order

1. **Profile service** — foundation, everything depends on this
2. **News curator** — consumes profile, produces curated feed
3. **Scheduler** — runs curator on a timer
4. **Core agent chat** — consumes everything, interactive
5. **Frontend** — wires up curated feed + profile settings

## File Layout

**New backend files:**
```
src/services/profile/__init__.py
src/services/profile/service.py
src/services/profile/store.py
src/services/profile/models.py
src/services/profile/errors.py
src/services/news/curator.py
src/services/scheduler/__init__.py
src/services/scheduler/service.py
src/services/scheduler/store.py
src/services/scheduler/runner.py
src/services/scheduler/models.py
src/core/agents/core.py
src/gateway/routes/profile.py
src/gateway/routes/schedule.py
```

**New frontend files:**
```
src/api/profile.ts
src/api/schedule.ts
```

**Modified backend files:**
```
src/gateway/__main__.py        — register routers, start scheduler via lifespan
src/core/agents/__init__.py    — register CoreAgent in AGENTS dict
src/core/agents/head.py        — add "core" to _AGENT_CONTEXT and route descriptions
src/core/tools/registry.py     — add CORE_TOOLS definitions
```

**Modified frontend files:**
```
src/tools/news/NewsPage.tsx     — add "For You" tab (UI-only, not in NewsTopic)
src/tools/SettingsPage.tsx      — add Profile section
```
