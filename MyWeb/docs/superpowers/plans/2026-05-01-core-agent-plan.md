# Core Agent & Personal News Curation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal agent system with user profiles, background news curation, scheduled tasks, and an interactive chat agent.

**Architecture:** User Profile Service (data layer) → News Curator Agent (background LLM scoring) → Scheduler (async loop) → Core Chat Agent (interactive). Each component is a separate service following existing patterns.

**Tech Stack:** Python/FastAPI/SQLite (backend), React/TypeScript (frontend), Ollama LLM (local), feedparser (RSS)

**Spec:** `docs/superpowers/specs/2026-05-01-core-agent-design.md`

---

## Chunk 1: Profile Service (Backend)

### Task 1: Profile Store — Tables and CRUD

**Files:**
- Create: `MyAgent/src/services/profile/__init__.py`
- Create: `MyAgent/src/services/profile/store.py`
- Create: `MyAgent/src/services/profile/errors.py`
- Test: `MyAgent/tests/test_profile_store.py`

- [ ] **Step 1: Write failing tests for profile store**

```python
# tests/test_profile_store.py
import pytest
from src.services.profile.store import ProfileStore

@pytest.fixture
def store(tmp_path, monkeypatch):
    monkeypatch.setattr("src.core.db.DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr("src.services.profile.store._migrated", False)
    # Create users table for FK
    from src.core.db import _connect
    conn = _connect()
    conn.execute("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, email TEXT, created_at REAL, updated_at REAL)")
    conn.execute("INSERT INTO users VALUES ('u1', 'test@test.com', 0, 0)")
    conn.commit()
    conn.close()
    return ProfileStore()

def test_get_interests_returns_empty_for_new_user(store):
    assert store.get_interests("u1") == []

def test_set_and_get_interests(store):
    store.set_interests("u1", ["AI", "hip hop", "gaming"])
    assert store.get_interests("u1") == ["AI", "hip hop", "gaming"]

def test_set_interests_overwrites(store):
    store.set_interests("u1", ["AI"])
    store.set_interests("u1", ["gaming"])
    assert store.get_interests("u1") == ["gaming"]

def test_log_and_get_signals(store):
    store.log_signal("u1", "article_click", "AI", "Ars Technica")
    store.log_signal("u1", "topic_browse", "Gaming", "news_page")
    signals = store.get_recent_signals("u1", limit=10)
    assert len(signals) == 2
    assert signals[0]["topic"] == "Gaming"  # most recent first

def test_model_config_defaults_to_empty(store):
    assert store.get_model_config("u1") == {}

def test_set_and_get_model_config(store):
    store.set_model_config("u1", {"news_curation": "qwen3:32b", "core_chat": "llama3.1:8b"})
    config = store.get_model_config("u1")
    assert config["news_curation"] == "qwen3:32b"
    assert config["core_chat"] == "llama3.1:8b"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/test_profile_store.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Create errors module**

```python
# src/services/profile/errors.py
"""Profile service errors."""

class ProfileServiceError(Exception):
    pass

class ProfileNotFoundError(ProfileServiceError):
    pass
```

- [ ] **Step 4: Create empty __init__.py**

```python
# src/services/profile/__init__.py
```

- [ ] **Step 5: Implement ProfileStore**

```python
# src/services/profile/store.py
"""Profile store — owns user_profile and profile_signals tables."""
import json
import time
import uuid

from src.core.db import _connect

_migrated = False

def _ensure_tables() -> None:
    global _migrated
    if _migrated:
        return
    conn = _connect()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_profile (
            user_id      TEXT PRIMARY KEY,
            interests    TEXT NOT NULL DEFAULT '[]',
            model_config TEXT NOT NULL DEFAULT '{}',
            updated_at   REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS profile_signals (
            signal_id   TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            signal_type TEXT NOT NULL,
            topic       TEXT NOT NULL,
            source      TEXT NOT NULL DEFAULT '',
            created_at  REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_profile_signals_user
        ON profile_signals(user_id, created_at DESC)
    """)
    conn.commit()
    conn.close()
    _migrated = True


class ProfileStore:
    def get_interests(self, user_id: str) -> list[str]:
        _ensure_tables()
        conn = _connect()
        row = conn.execute(
            "SELECT interests FROM user_profile WHERE user_id = ?", (user_id,)
        ).fetchone()
        conn.close()
        if not row:
            return []
        return json.loads(row[0])

    def set_interests(self, user_id: str, interests: list[str]) -> None:
        _ensure_tables()
        now = time.time()
        conn = _connect()
        conn.execute(
            "INSERT INTO user_profile (user_id, interests, model_config, updated_at) "
            "VALUES (?, ?, '{}', ?) "
            "ON CONFLICT(user_id) DO UPDATE SET interests = ?, updated_at = ?",
            (user_id, json.dumps(interests), now, json.dumps(interests), now),
        )
        conn.commit()
        conn.close()

    def log_signal(self, user_id: str, signal_type: str, topic: str, source: str = "") -> None:
        _ensure_tables()
        conn = _connect()
        conn.execute(
            "INSERT INTO profile_signals (signal_id, user_id, signal_type, topic, source, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, signal_type, topic, source, time.time()),
        )
        conn.commit()
        conn.close()

    def get_recent_signals(self, user_id: str, limit: int = 50) -> list[dict]:
        _ensure_tables()
        conn = _connect()
        rows = conn.execute(
            "SELECT signal_id, signal_type, topic, source, created_at "
            "FROM profile_signals WHERE user_id = ? "
            "ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        conn.close()
        return [
            {"signal_id": r[0], "signal_type": r[1], "topic": r[2], "source": r[3], "created_at": r[4]}
            for r in rows
        ]

    def get_model_config(self, user_id: str) -> dict[str, str]:
        _ensure_tables()
        conn = _connect()
        row = conn.execute(
            "SELECT model_config FROM user_profile WHERE user_id = ?", (user_id,)
        ).fetchone()
        conn.close()
        if not row:
            return {}
        return json.loads(row[0])

    def set_model_config(self, user_id: str, config: dict[str, str]) -> None:
        _ensure_tables()
        now = time.time()
        conn = _connect()
        conn.execute(
            "INSERT INTO user_profile (user_id, interests, model_config, updated_at) "
            "VALUES (?, '[]', ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET model_config = ?, updated_at = ?",
            (user_id, json.dumps(config), now, json.dumps(config), now),
        )
        conn.commit()
        conn.close()
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/test_profile_store.py -v`
Expected: All 7 tests PASS

- [ ] **Step 7: Commit**

```bash
cd MyAgent && git add src/services/profile/ tests/test_profile_store.py
git commit -m "feat: add profile store with interests, signals, and model config"
```

---

### Task 2: Profile Service — Business Logic and Context Snapshots

**Files:**
- Create: `MyAgent/src/services/profile/models.py`
- Create: `MyAgent/src/services/profile/service.py`
- Test: `MyAgent/tests/test_profile_service.py`

- [ ] **Step 1: Write failing tests for ProfileService**

```python
# tests/test_profile_service.py
import pytest
from unittest.mock import MagicMock, patch
from src.services.profile.service import ProfileService

@pytest.fixture
def service(tmp_path, monkeypatch):
    monkeypatch.setattr("src.core.db.DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr("src.services.profile.store._migrated", False)
    from src.core.db import _connect
    conn = _connect()
    conn.execute("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, email TEXT, created_at REAL, updated_at REAL)")
    conn.execute("INSERT INTO users VALUES ('u1', 'test@test.com', 0, 0)")
    conn.commit()
    conn.close()
    return ProfileService()

def test_set_and_get_interests(service):
    service.set_interests("u1", ["AI", "gaming"])
    assert service.get_interests("u1") == ["AI", "gaming"]

def test_get_model_falls_back_to_default(service):
    model = service.get_model("u1", "news_curation")
    assert model  # returns DEFAULT_MODEL, not empty

def test_get_model_uses_user_config(service):
    service.set_model_config("u1", {"news_curation": "qwen3:32b"})
    assert service.get_model("u1", "news_curation") == "qwen3:32b"
    # unconfigured service falls back
    assert service.get_model("u1", "core_chat") != "qwen3:32b"

def test_context_snapshot_returns_all_fields(service):
    service.set_interests("u1", ["AI"])
    service.log_signal("u1", "article_click", "AI", "Ars Technica")
    snapshot = service.context_snapshot("u1")
    assert snapshot.user_id == "u1"
    assert snapshot.interests == ["AI"]
    assert len(snapshot.recent_signals) == 1
    assert isinstance(snapshot.calendar_today, list)
    assert isinstance(snapshot.mail_subjects, list)
    assert isinstance(snapshot.memories, list)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/test_profile_service.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Create models**

```python
# src/services/profile/models.py
"""Profile service models."""
from pydantic import BaseModel


class Signal(BaseModel):
    signal_id: str
    signal_type: str
    topic: str
    source: str
    created_at: float


class ContextSnapshot(BaseModel):
    user_id: str
    interests: list[str]
    recent_signals: list[Signal]
    calendar_today: list[dict]
    calendar_upcoming: list[dict]
    mail_subjects: list[str]
    memories: list[str]


class UpdateInterestsRequest(BaseModel):
    interests: list[str]


class UpdateModelConfigRequest(BaseModel):
    config: dict[str, str]


class LogSignalRequest(BaseModel):
    signal_type: str
    topic: str
    source: str = ""
```

- [ ] **Step 4: Implement ProfileService**

```python
# src/services/profile/service.py
"""Profile service — user interests, behavior signals, and context snapshots."""
import logging
from datetime import date, timedelta

from src.core.config import DEFAULT_MODEL
from src.services.profile.models import ContextSnapshot, Signal
from src.services.profile.store import ProfileStore

log = logging.getLogger(__name__)


class ProfileService:
    def __init__(self):
        self._store = ProfileStore()

    def get_interests(self, user_id: str) -> list[str]:
        return self._store.get_interests(user_id)

    def set_interests(self, user_id: str, interests: list[str]) -> None:
        self._store.set_interests(user_id, interests)

    def log_signal(self, user_id: str, signal_type: str, topic: str, source: str = "") -> None:
        self._store.log_signal(user_id, signal_type, topic, source)

    def get_model(self, user_id: str, service_name: str) -> str:
        config = self._store.get_model_config(user_id)
        return config.get(service_name, DEFAULT_MODEL)

    def set_model_config(self, user_id: str, config: dict[str, str]) -> None:
        self._store.set_model_config(user_id, config)

    def get_model_config(self, user_id: str) -> dict[str, str]:
        return self._store.get_model_config(user_id)

    def context_snapshot(self, user_id: str) -> ContextSnapshot:
        interests = self._store.get_interests(user_id)
        raw_signals = self._store.get_recent_signals(user_id, limit=50)
        signals = [Signal(**s) for s in raw_signals]

        # Calendar — graceful if service unavailable
        calendar_today: list[dict] = []
        calendar_upcoming: list[dict] = []
        try:
            from src.services.calendar.service import CalendarService
            cal = CalendarService()
            today = date.today().isoformat()
            end = (date.today() + timedelta(days=3)).isoformat()
            today_events = cal.get_events(user_id, today, today)
            upcoming_events = cal.get_events(user_id, today, end)
            calendar_today = [e.model_dump() for e in today_events]
            calendar_upcoming = [e.model_dump() for e in upcoming_events]
        except Exception:
            log.debug("Calendar unavailable for context snapshot")

        # Memories — semantic search for interests
        memories: list[str] = []
        try:
            from src.services.memory.service import recall
            if interests:
                query = ", ".join(interests[:5])
                results = recall(query, user_id, top_k=10)
                memories = [r["content"] for r in results]
        except Exception:
            log.debug("Memory service unavailable for context snapshot")

        # Mail — graceful degradation (requires session credentials)
        mail_subjects: list[str] = []
        # Mail access deferred to interactive context (requires IMAP creds from JWT)

        return ContextSnapshot(
            user_id=user_id,
            interests=interests,
            recent_signals=signals,
            calendar_today=calendar_today,
            calendar_upcoming=calendar_upcoming,
            mail_subjects=mail_subjects,
            memories=memories,
        )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/test_profile_service.py -v`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
cd MyAgent && git add src/services/profile/models.py src/services/profile/service.py tests/test_profile_service.py
git commit -m "feat: add profile service with context snapshots"
```

---

### Task 3: Profile API Routes

**Files:**
- Create: `MyAgent/src/gateway/routes/profile.py`
- Modify: `MyAgent/src/gateway/__main__.py`
- Test: `MyAgent/tests/test_profile_routes.py`

- [ ] **Step 1: Write failing tests for profile routes**

```python
# tests/test_profile_routes.py
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from src.gateway.__main__ import app

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr("src.core.db.DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr("src.services.profile.store._migrated", False)
    from src.core.db import _connect
    conn = _connect()
    conn.execute("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, email TEXT, created_at REAL, updated_at REAL)")
    conn.execute("INSERT INTO users VALUES ('u1', 'test@test.com', 0, 0)")
    conn.commit()
    conn.close()
    return TestClient(app)

@pytest.fixture
def auth_headers():
    from src.core.jwt import create_session_token
    token = create_session_token("u1", enc_key="", is_admin=False)
    return {"Authorization": f"Bearer {token}"}

def test_get_profile_empty(client, auth_headers):
    resp = client.get("/api/profile", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["interests"] == []
    assert data["model_config"] == {}

def test_set_interests(client, auth_headers):
    resp = client.put("/api/profile/interests", json={"interests": ["AI", "gaming"]}, headers=auth_headers)
    assert resp.status_code == 200
    resp = client.get("/api/profile", headers=auth_headers)
    assert resp.json()["interests"] == ["AI", "gaming"]

def test_set_model_config(client, auth_headers):
    resp = client.put("/api/profile/models", json={"config": {"news_curation": "qwen3:32b"}}, headers=auth_headers)
    assert resp.status_code == 200
    resp = client.get("/api/profile", headers=auth_headers)
    assert resp.json()["model_config"]["news_curation"] == "qwen3:32b"

def test_log_signal(client, auth_headers):
    resp = client.post("/api/profile/signal", json={"signal_type": "article_click", "topic": "AI", "source": "news"}, headers=auth_headers)
    assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/test_profile_routes.py -v`
Expected: FAIL — 404 (routes not registered)

- [ ] **Step 3: Implement profile routes**

```python
# src/gateway/routes/profile.py
"""Profile routes — /api/profile/*."""
from fastapi import APIRouter, Request

from src.gateway.middleware import jwt_required
from src.services.profile.models import UpdateInterestsRequest, UpdateModelConfigRequest, LogSignalRequest
from src.services.profile.service import ProfileService

router = APIRouter()
_profile = ProfileService()


@router.get("/api/profile")
async def get_profile(request: Request):
    payload = jwt_required(request)
    user_id = payload["user_id"]
    return {
        "interests": _profile.get_interests(user_id),
        "model_config": _profile.get_model_config(user_id),
    }


@router.put("/api/profile/interests")
async def set_interests(request: Request, body: UpdateInterestsRequest):
    payload = jwt_required(request)
    _profile.set_interests(payload["user_id"], body.interests)
    return {"status": "ok"}


@router.put("/api/profile/models")
async def set_model_config(request: Request, body: UpdateModelConfigRequest):
    payload = jwt_required(request)
    _profile.set_model_config(payload["user_id"], body.config)
    return {"status": "ok"}


@router.post("/api/profile/signal")
async def log_signal(request: Request, body: LogSignalRequest):
    payload = jwt_required(request)
    _profile.log_signal(payload["user_id"], body.signal_type, body.topic, body.source)
    return {"status": "ok"}
```

- [ ] **Step 4: Register profile router in __main__.py**

Add to imports:
```python
from src.gateway.routes import auth, memory, search, mail, chat, calendar, news, profile
```

Add after news router:
```python
app.include_router(profile.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/test_profile_routes.py -v`
Expected: All 4 tests PASS

- [ ] **Step 6: Run all backend tests**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/ -v`
Expected: All tests PASS (existing + new)

- [ ] **Step 7: Commit**

```bash
cd MyAgent && git add src/gateway/routes/profile.py src/gateway/__main__.py tests/test_profile_routes.py
git commit -m "feat: add profile API routes for interests, models, and signals"
```

---

## Chunk 2: News Curator (Backend)

### Task 4: Curated Articles Store

**Files:**
- Modify: `MyAgent/src/services/news/store.py` — add curated_articles, curated_ratings, source_ratings tables and queries
- Test: `MyAgent/tests/test_curated_store.py`

- [ ] **Step 1: Write failing tests for curated store methods**

Tests should cover:
- `upsert_curated(user_id, article_id, summary, score, reason)` — insert curated pick
- `list_curated(user_id, limit, offset)` — get curated feed ordered by created_at DESC, joined with article title/url/topic/source_label
- `get_uncurated_articles(user_id)` — `LEFT JOIN curated_articles ... WHERE curated_id IS NULL`, returns list[dict] with article fields
- `rate_curated(user_id, curated_id, rating)` — UNIQUE(user_id, curated_id) ON CONFLICT REPLACE. Also logs a profile signal via ProfileStore
- `rate_source(user_id, source_id, rating)` — UNIQUE(user_id, source_id) ON CONFLICT REPLACE
- `get_curated_ratings(user_id)` — returns `{"upvoted": ["topic1", ...], "downvoted": ["topic2", ...]}` aggregated from curated_ratings joined with articles
- `get_source_ratings(user_id)` — returns `{"preferred": ["source_label1", ...], "deprioritized": ["source_label2", ...]}` aggregated from source_ratings joined with news_sources

```python
# tests/test_curated_store.py — key tests
def test_upsert_and_list_curated(store, seed_article):
    store.upsert_curated("u1", seed_article, "Great article about AI", 0.9, "Matches AI interest")
    curated = store.list_curated("u1", limit=10, offset=0)
    assert len(curated) == 1
    assert curated[0]["summary"] == "Great article about AI"
    assert curated[0]["relevance_score"] == 0.9

def test_get_uncurated_articles_excludes_curated(store, seed_article, seed_article_2):
    store.upsert_curated("u1", seed_article, "summary", 0.8, "reason")
    uncurated = store.get_uncurated_articles("u1")
    ids = [a["id"] for a in uncurated]
    assert seed_article not in ids
    assert seed_article_2 in ids

def test_rate_curated_upserts(store, seed_curated):
    store.rate_curated("u1", seed_curated, 1)
    store.rate_curated("u1", seed_curated, -1)  # replaces
    ratings = store.get_curated_ratings("u1")
    assert isinstance(ratings["downvoted"], list)

def test_rate_curated_logs_signal(store, seed_curated):
    from src.services.profile.store import ProfileStore
    store.rate_curated("u1", seed_curated, 1)
    signals = ProfileStore().get_recent_signals("u1")
    assert any(s["signal_type"] == "curated_rating" for s in signals)

def test_rate_source(store, seed_source):
    store.rate_source("u1", seed_source, -1)
    ratings = store.get_source_ratings("u1")
    assert isinstance(ratings["deprioritized"], list)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/test_curated_store.py -v`

- [ ] **Step 3: Add curated tables to `_ensure_tables()` in store.py and implement methods**

Add three new tables (`curated_articles`, `curated_ratings`, `source_ratings`) and the query methods to `NewsStore`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/test_curated_store.py -v`

- [ ] **Step 5: Commit**

```bash
cd MyAgent && git add src/services/news/store.py tests/test_curated_store.py
git commit -m "feat: add curated articles, ratings, and source ratings to news store"
```

---

### Task 5: News Curator — LLM Scoring and Summarization

**Files:**
- Create: `MyAgent/src/services/news/curator.py`
- Test: `MyAgent/tests/test_news_curator.py`

- [ ] **Step 1: Write failing tests for NewsCurator**

Tests should cover:
```python
# tests/test_news_curator.py
import json
import pytest
from unittest.mock import patch, MagicMock
from src.services.news.curator import NewsCurator

@pytest.fixture
def curator(tmp_path, monkeypatch):
    monkeypatch.setattr("src.core.db.DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr("src.services.profile.store._migrated", False)
    monkeypatch.setattr("src.services.news.store._migrated", False)
    from src.core.db import _connect
    conn = _connect()
    conn.execute("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, email TEXT, created_at REAL, updated_at REAL)")
    conn.execute("INSERT INTO users VALUES ('u1', 'test@test.com', 0, 0)")
    conn.commit()
    conn.close()
    return NewsCurator()

@pytest.mark.asyncio
async def test_curate_returns_zero_when_no_articles(curator):
    from src.services.profile.service import ProfileService
    ProfileService().set_interests("u1", ["AI"])
    result = await curator.curate("u1")
    assert result == 0

@pytest.mark.asyncio
async def test_curate_scores_and_saves_picks(curator):
    # Seed a source + article
    from src.services.news.store import NewsStore
    from src.services.profile.service import ProfileService
    ProfileService().set_interests("u1", ["AI"])
    store = NewsStore()
    src = store.create_source("u1", "Test", "Tech", "http://test.com/rss")
    store.upsert_articles("u1", src["id"], [
        {"title": "AI breakthrough", "topic": "Tech", "url": "http://test.com/1", "published_at": "2026-05-01", "summary": "Big AI news"}
    ])

    llm_response = json.dumps({"results": [
        {"article_id": "WILL_BE_REPLACED", "score": 0.9, "summary": "Major AI advance", "reason": "Matches AI interest"}
    ]})

    with patch("src.services.news.curator.default_adapter") as mock_adapter:
        # Get the real article ID
        uncurated = store.get_uncurated_articles("u1")
        real_id = uncurated[0]["id"]
        llm_response = json.dumps({"results": [
            {"article_id": real_id, "score": 0.9, "summary": "Major AI advance", "reason": "Matches AI interest"}
        ]})
        mock_adapter.complete_sync.return_value = llm_response
        result = await curator.curate("u1")

    assert result == 1
    curated = store.list_curated("u1")
    assert len(curated) == 1
    assert curated[0]["summary"] == "Major AI advance"

@pytest.mark.asyncio
async def test_curate_skips_low_scores(curator):
    from src.services.news.store import NewsStore
    from src.services.profile.service import ProfileService
    ProfileService().set_interests("u1", ["AI"])
    store = NewsStore()
    src = store.create_source("u1", "Test", "Tech", "http://test.com/rss")
    store.upsert_articles("u1", src["id"], [
        {"title": "Boring article", "topic": "Tech", "url": "http://test.com/2", "published_at": "2026-05-01", "summary": "Meh"}
    ])

    uncurated = store.get_uncurated_articles("u1")
    llm_response = json.dumps({"results": [
        {"article_id": uncurated[0]["id"], "score": 0.2, "summary": "Not relevant", "reason": "Low match"}
    ]})

    with patch("src.services.news.curator.default_adapter") as mock_adapter:
        mock_adapter.complete_sync.return_value = llm_response
        result = await curator.curate("u1")

    assert result == 0
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement NewsCurator**

```python
# src/services/news/curator.py
"""News curator — LLM-based article scoring and summarization."""
import json
import logging

from src.services.llm.adapters import default_adapter
from src.services.news.service import NewsService
from src.services.news.store import NewsStore
from src.services.profile.service import ProfileService

log = logging.getLogger(__name__)

BATCH_SIZE = 20
SCORE_THRESHOLD = 0.5

SYSTEM_PROMPT = """You are a personal news curator. Given the user's interests and context, score each article's relevance from 0 to 1 and write a concise 1-2 sentence summary for anything scoring above 0.5.

User context:
- Interests: {interests}
- Today's calendar: {calendar_today}
- Key memories: {memories}
- Recent behavior: {recent_signals}
- Liked topics: {upvoted_topics}
- Disliked topics: {downvoted_topics}
- Preferred sources: {upvoted_sources}
- Deprioritized sources: {downvoted_sources}

Respond with JSON: {{"results": [{{"article_id": "...", "score": 0.85, "summary": "...", "reason": "..."}}]}}
Only include articles with score > 0.5."""


class NewsCurator:
    def __init__(self):
        self._profile = ProfileService()
        self._news = NewsService()
        self._store = NewsStore()

    async def curate(self, user_id: str) -> int:
        snapshot = self._profile.context_snapshot(user_id)
        model = self._profile.get_model(user_id, "news_curation")
        uncurated = self._store.get_uncurated_articles(user_id)
        if not uncurated:
            return 0

        # Get rating signals for prompt
        curated_ratings = self._store.get_curated_ratings(user_id)
        source_ratings = self._store.get_source_ratings(user_id)

        system = SYSTEM_PROMPT.format(
            interests=", ".join(snapshot.interests) or "none set",
            calendar_today=json.dumps([e.get("title", "") for e in snapshot.calendar_today]) if snapshot.calendar_today else "none",
            memories=json.dumps(snapshot.memories[:5]) if snapshot.memories else "none",
            recent_signals=json.dumps([s.topic for s in snapshot.recent_signals[:10]]) if snapshot.recent_signals else "none",
            upvoted_topics=json.dumps(curated_ratings.get("upvoted", [])),
            downvoted_topics=json.dumps(curated_ratings.get("downvoted", [])),
            upvoted_sources=json.dumps(source_ratings.get("preferred", [])),
            downvoted_sources=json.dumps(source_ratings.get("deprioritized", [])),
        )

        total = 0
        for i in range(0, len(uncurated), BATCH_SIZE):
            batch = uncurated[i:i + BATCH_SIZE]
            articles_json = json.dumps([
                {"id": a["id"], "title": a["title"], "source": a.get("source_label", ""), "topic": a["topic"], "summary": a.get("summary", "")}
                for a in batch
            ])
            try:
                result = default_adapter.complete_sync(
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": articles_json},
                    ],
                    schema=_CURATOR_SCHEMA,
                    model=model,
                )
                parsed = json.loads(result) if isinstance(result, str) else result
                for item in parsed.get("results", []):
                    if item.get("score", 0) >= SCORE_THRESHOLD:
                        self._store.upsert_curated(
                            user_id=user_id,
                            article_id=item["article_id"],
                            summary=item.get("summary", ""),
                            score=item["score"],
                            reason=item.get("reason", ""),
                        )
                        total += 1
            except Exception:
                log.warning("Curator batch failed", exc_info=True)

        return total


_CURATOR_SCHEMA = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "article_id": {"type": "string"},
                    "score": {"type": "number"},
                    "summary": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["article_id", "score"],
            },
        },
    },
    "required": ["results"],
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
cd MyAgent && git add src/services/news/curator.py tests/test_news_curator.py
git commit -m "feat: add news curator with LLM scoring and summarization"
```

---

### Task 6: Curated Feed API Routes + Rating Endpoints

**Files:**
- Modify: `MyAgent/src/gateway/routes/news.py` — add curated feed, curation trigger, and rating endpoints
- Test: `MyAgent/tests/test_curated_routes.py`

- [ ] **Step 1: Write failing tests for curated endpoints**

Tests should cover:
- `GET /api/news/curated` — returns curated feed (empty initially)
- `POST /api/news/curate` — triggers curation (admin only)
- `POST /api/news/curated/{id}/rate` — rate curated article
- `POST /api/news/sources/{id}/rate` — rate source

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Add endpoints to news routes**

Add to `src/gateway/routes/news.py`:
- `GET /api/news/curated` — jwt_required, calls `store.list_curated()`
- `POST /api/news/curate` — admin_required, calls `NewsCurator().curate()`
- `POST /api/news/curated/{id}/rate` — jwt_required, calls `store.rate_curated()`
- `POST /api/news/sources/{id}/rate` — jwt_required, calls `store.rate_source()`

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Run all backend tests**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd MyAgent && git add src/gateway/routes/news.py tests/test_curated_routes.py
git commit -m "feat: add curated feed and rating API endpoints"
```

---

## Chunk 3: Background Scheduler

### Task 7: Scheduler Store and Service

**Files:**
- Create: `MyAgent/src/services/scheduler/__init__.py`
- Create: `MyAgent/src/services/scheduler/store.py`
- Create: `MyAgent/src/services/scheduler/service.py`
- Create: `MyAgent/src/services/scheduler/models.py`
- Test: `MyAgent/tests/test_scheduler.py`

- [ ] **Step 1: Write failing tests**

Tests should cover:
- `create_task(user_id, task_type, schedule)` — creates scheduled task
- `get_user_tasks(user_id)` — list user's tasks
- `get_overdue_tasks()` — returns tasks where `next_run_at < now`
- `mark_completed(task_id)` — updates `last_run_at`, computes `next_run_at`
- `update_task(task_id, schedule, enabled)` — update schedule or toggle
- Schedule parsing: "4h" → 14400 seconds

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement models, store, and service**

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
cd MyAgent && git add src/services/scheduler/ tests/test_scheduler.py
git commit -m "feat: add scheduler service with task management"
```

---

### Task 8: Scheduler Runner and FastAPI Integration

**Files:**
- Create: `MyAgent/src/services/scheduler/runner.py`
- Modify: `MyAgent/src/gateway/__main__.py` — add lifespan with scheduler
- Test: `MyAgent/tests/test_scheduler_runner.py`

- [ ] **Step 1: Write failing tests for runner**

Tests should cover:
- `_run_task(task)` dispatches to correct handler
- Unknown task_type is logged and skipped
- Task failure doesn't crash the loop

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement runner**

```python
# src/services/scheduler/runner.py
"""Scheduler runner — async background loop for scheduled tasks."""
import asyncio
import logging

from src.services.scheduler.store import SchedulerStore
from src.services.news.curator import NewsCurator

log = logging.getLogger(__name__)

_store = SchedulerStore()

TASK_HANDLERS = {
    "news_curation": lambda user_id: NewsCurator().curate(user_id),
}


async def scheduler_loop():
    """Check for overdue tasks every 60 seconds."""
    while True:
        await asyncio.sleep(60)
        try:
            overdue = _store.get_overdue_tasks()
            for task in overdue:
                handler = TASK_HANDLERS.get(task["task_type"])
                if not handler:
                    log.warning("Unknown task type: %s", task["task_type"])
                    continue
                try:
                    await handler(task["user_id"])
                    _store.mark_completed(task["task_id"])
                    log.info("Completed task %s (%s) for user %s", task["task_id"], task["task_type"], task["user_id"])
                except Exception:
                    log.warning("Task %s failed", task["task_id"], exc_info=True)
        except Exception:
            log.warning("Scheduler loop error", exc_info=True)
```

- [ ] **Step 4: Add lifespan to __main__.py**

```python
import asyncio
from contextlib import asynccontextmanager
from src.services.scheduler.runner import scheduler_loop

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()

app = FastAPI(lifespan=lifespan)
```

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Add schedule API routes**

Create `src/gateway/routes/schedule.py` with:
- `GET /api/schedule` — jwt_required, list user's tasks
- `PUT /api/schedule/{task_id}` — jwt_required, update schedule/enable/disable

Register in `__main__.py`.

- [ ] **Step 7: Run all backend tests**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
cd MyAgent && git add src/services/scheduler/runner.py src/gateway/__main__.py src/gateway/routes/schedule.py tests/test_scheduler_runner.py
git commit -m "feat: add background scheduler with FastAPI lifespan integration"
```

---

## Chunk 4: Core Chat Agent

### Task 9: Core Agent Tools and Registration

**Files:**
- Modify: `MyAgent/src/core/tools/registry.py` — add CORE_TOOLS definitions
- Modify: `MyAgent/src/core/executor.py` — add tool handlers for core tools
- Test: `MyAgent/tests/test_core_tools.py`

- [ ] **Step 1: Write failing tests for core tool handlers**

Tests should cover all 10 CORE_TOOLS:
- `search_news` — returns articles matching query (calls NewsStore.list_articles with keyword filter)
- `get_curated` — returns curated picks (calls NewsStore.list_curated)
- `get_calendar` — returns upcoming events (calls CalendarService.get_events)
- `get_mail_summary` — returns recent email subjects when session creds available; returns empty gracefully when not
- `get_memories` — returns relevant memories (calls MemoryService.recall)
- `get_profile` — returns user interests and recent signals
- `create_calendar_event` — creates an event (calls CalendarService.create_event)
- `remember` — reuses existing REMEMBER tool handler
- `answer` — reuses existing ANSWER tool handler
- `done` — reuses existing DONE tool handler

Each test mocks the underlying service and verifies the tool handler calls it correctly. `remember`, `answer`, and `done` already exist in `TOOL_REGISTRY` — just include them in CORE_TOOLS list, no new handlers needed.

`get_mail_summary` is a new tool handler that attempts to read recent emails from the session's mail engine. If no IMAP credentials are available (background context), it returns "Mail not available in this context."

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Define CORE_TOOLS in registry.py**

Add tool definitions following existing pattern (`ToolDef` with `ParamDef` params).

- [ ] **Step 4: Add tool handlers to executor.py TOOL_REGISTRY**

Register each core tool's async handler function.

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
cd MyAgent && git add src/core/tools/registry.py src/core/executor.py tests/test_core_tools.py
git commit -m "feat: add core agent tool definitions and handlers"
```

---

### Task 10: CoreAgent Definition and HeadAgent Routing

**Files:**
- Create: `MyAgent/src/core/agents/core.py`
- Modify: `MyAgent/src/core/agents/__init__.py` — register CoreAgent
- Modify: `MyAgent/src/core/agents/head.py` — add "core" route
- Test: `MyAgent/tests/test_core_agent.py`

- [ ] **Step 1: Write failing tests**

Tests should cover:
- CoreAgent has correct tools list
- CoreAgent system_prompt includes user context
- HeadAgent routes "what should I focus on today?" to "core"
- HeadAgent routes "what's happening in AI?" to "core"
- HeadAgent still routes "read my email" to "mail"

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement CoreAgent**

```python
# src/core/agents/core.py
"""Core agent — personal assistant with full context access."""
from src.core.agents.base import AgentDef
from src.core.tools.registry import CORE_TOOLS
from src.core.tools.prompt import build_system_prompt
from src.services.profile.service import ProfileService


class CoreAgent(AgentDef):
    name = "core"
    tools = CORE_TOOLS

    def system_prompt(self, **kwargs) -> str:
        user_id = kwargs.get("user_id", "")
        context = ""
        if user_id:
            try:
                profile = ProfileService()
                snapshot = profile.context_snapshot(user_id)
                context = snapshot.model_dump_json(indent=2)
            except Exception:
                context = "Context unavailable"

        return build_system_prompt(
            role="the user's personal agent. You know their interests, schedule, email, and stored memories. Use your tools to answer questions grounded in real data — never guess or use stale info.",
            tools=self.tools,
            context=context,
        )
```

- [ ] **Step 4: Register in agents/__init__.py, update head.py, and wire model selection**

In `agents/__init__.py`: add `"core": CoreAgent()` to AGENTS dict.
In `agents/head.py`: add `core` to `_AGENT_CONTEXT` with description: "Personal context queries, news questions, cross-domain briefings."
In `chat.py` route (or executor dispatch): resolve model via `ProfileService().get_model(user_id, "core_chat")` and pass to executor when agent is "core".

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Run all backend tests**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd MyAgent && git add src/core/agents/core.py src/core/agents/__init__.py src/core/agents/head.py tests/test_core_agent.py
git commit -m "feat: add CoreAgent with full context access and HeadAgent routing"
```

---

## Chunk 5: Frontend Integration

### Task 11: Frontend API Clients

**Files:**
- Create: `MyWeb/src/api/profile.ts`
- Create: `MyWeb/src/api/schedule.ts`
- Modify: `MyWeb/src/api/news.ts` — add curated feed and rating functions

- [ ] **Step 1: Create profile API client**

```typescript
// src/api/profile.ts
import { apiFetch } from "./client";

export interface UserProfile {
  interests: string[];
  model_config: Record<string, string>;
}

export function getProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/profile", { method: "GET" });
}

export function updateInterests(interests: string[]): Promise<void> {
  return apiFetch<void>("/api/profile/interests", {
    method: "PUT",
    body: JSON.stringify({ interests }),
  });
}

export function updateModelConfig(config: Record<string, string>): Promise<void> {
  return apiFetch<void>("/api/profile/models", {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

export function logSignal(signal_type: string, topic: string, source: string = ""): Promise<void> {
  return apiFetch<void>("/api/profile/signal", {
    method: "POST",
    body: JSON.stringify({ signal_type, topic, source }),
  });
}
```

- [ ] **Step 2: Create schedule API client**

```typescript
// src/api/schedule.ts
import { apiFetch } from "./client";

export interface ScheduledTask {
  task_id: string;
  task_type: string;
  schedule: string;
  last_run_at: number | null;
  next_run_at: number;
  enabled: boolean;
}

export function getSchedule(): Promise<{ tasks: ScheduledTask[] }> {
  return apiFetch<{ tasks: ScheduledTask[] }>("/api/schedule", { method: "GET" });
}

export function updateSchedule(
  taskId: string,
  updates: { schedule?: string; enabled?: boolean },
): Promise<ScheduledTask> {
  return apiFetch<ScheduledTask>(`/api/schedule/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}
```

- [ ] **Step 3: Add curated and rating functions to news.ts**

Add to `src/api/news.ts`:
```typescript
export interface CuratedArticle {
  curated_id: string;
  article_id: string;
  title: string;
  source_label: string;
  topic: string;
  url: string;
  summary: string;
  relevance_score: number;
  reason: string;
  created_at: number;
}

export function getCuratedFeed(limit = 20, offset = 0): Promise<{ articles: CuratedArticle[] }> {
  return apiFetch<{ articles: CuratedArticle[] }>(
    `/api/news/curated?limit=${limit}&offset=${offset}`,
    { method: "GET" },
  );
}

export function rateCurated(curatedId: string, rating: 1 | -1): Promise<void> {
  return apiFetch<void>(`/api/news/curated/${curatedId}/rate`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

export function rateSource(sourceId: string, rating: 1 | -1): Promise<void> {
  return apiFetch<void>(`/api/news/sources/${sourceId}/rate`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}
```

- [ ] **Step 4: Commit**

```bash
cd MyProject && git add MyWeb/src/api/profile.ts MyWeb/src/api/schedule.ts MyWeb/src/api/news.ts
git commit -m "feat: add frontend API clients for profile, schedule, and curated feed"
```

---

### Task 12: News Page — "For You" Tab

**Files:**
- Modify: `MyWeb/src/tools/news/NewsPage.tsx` — add "For You" tab with curated feed
- Modify: `MyWeb/src/tools/news/NewsPage.test.tsx` — add tests for "For You" tab
- Modify: `MyWeb/src/api/news.ts` — ensure curated types are exported

- [ ] **Step 1: Update NewsPage to add "For You" tab**

Key changes:
- Add `forYou` state flag (true when "For You" is active, default true)
- Tab list becomes `["For You", ...TOPICS]`
- When "For You" active: call `getCuratedFeed()`, render curated items with summary + reason + thumbs up/down
- When any topic active: existing behavior (call `getArticles()`)
- Thumbs up/down buttons call `rateCurated()` + `logSignal()`

- [ ] **Step 2: Write tests for "For You" tab**

Tests should cover:
- "For You" tab is selected by default
- Curated articles show summary and reason
- Thumbs up/down buttons call API
- Switching to a topic tab shows regular articles

- [ ] **Step 3: Run tests**

Run: `cd MyWeb && npx vitest run src/tools/news/NewsPage.test.tsx`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd MyProject && git add MyWeb/src/tools/news/NewsPage.tsx MyWeb/src/tools/news/NewsPage.test.tsx
git commit -m "feat: add For You tab with curated feed and article ratings"
```

---

### Task 13: Settings Page — Profile Section

**Files:**
- Modify: `MyWeb/src/tools/SettingsPage.tsx` — add Profile section
- Modify: `MyWeb/src/tools/SettingsPage.test.tsx` — add tests

- [ ] **Step 1: Add Profile section to SettingsPage**

Key changes:
- New section visible to all users (not admin-gated)
- **Interests:** text input + "Add" button, renders as tags with X to remove
- **Model config:** per-service dropdowns (news_curation, core_chat)
- **Schedule:** toggle curation on/off, frequency dropdown
- Loads profile on mount via `getProfile()`
- Saves interests via `updateInterests()`
- Saves model config via `updateModelConfig()`
- Loads/saves schedule via `getSchedule()` / `updateSchedule()`

- [ ] **Step 2: Write tests**

Tests should cover:
- Profile section renders with heading "Profile"
- Can add and remove interests
- Model config dropdowns appear
- Schedule toggle works

- [ ] **Step 3: Run all frontend tests**

Run: `cd MyWeb && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd MyProject && git add MyWeb/src/tools/SettingsPage.tsx MyWeb/src/tools/SettingsPage.test.tsx
git commit -m "feat: add profile settings with interests, model config, and schedule"
```

---

### Task 14: Final Integration Test and Roadmap Update

**Files:**
- Modify: `MyWeb/docs/superpowers/plans/2026-04-28-news-page-roadmap.md`

- [ ] **Step 1: Run all backend tests**

Run: `cd MyAgent && .venv/bin/python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 2: Run all frontend tests**

Run: `cd MyWeb && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Update news roadmap — mark Phase 5 done**

- [ ] **Step 4: Final commit**

```bash
cd MyProject && git add MyWeb/docs/superpowers/plans/2026-04-28-news-page-roadmap.md
git commit -m "docs: mark Phase 5 (personal news agent) as complete"
```
