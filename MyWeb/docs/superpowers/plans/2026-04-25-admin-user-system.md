# Admin User System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate admin-key login with a unified system where regular user accounts can be promoted to admin via an `ADMIN_EMAILS` env var, with an `is_admin` column in the DB as source of truth.

**Architecture:** Add `is_admin INTEGER DEFAULT 0` column to the `users` table. On login, if the user's email is in the `ADMIN_EMAILS` env var, auto-promote them (`is_admin=1`). The login response's `account` field changes from the user's email to `"admin"` when `is_admin=1`. The frontend already checks `localStorage["myagent.account"] === "admin"` via `isAdmin()` — this will now work naturally. The separate `/admin` login flow is removed; admin users access `/admin` through the normal authenticated session.

**Tech Stack:** Python/FastAPI (backend), React/TypeScript (frontend), SQLite

---

## File Structure

### Backend (MyAgent)

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/core/config.py:14` | Add `ADMIN_EMAILS` env var parsing |
| Modify | `src/services/auth/store.py:29-38` | Add `is_admin` column to schema, add `set_admin()` and `is_admin()` methods |
| Modify | `src/services/auth/service.py:43-77` | Check `ADMIN_EMAILS` on login/register, auto-promote, set `account` to `"admin"` |
| Modify | `src/services/auth/models.py:6-8` | No changes needed — `AuthResult.account` already carries the value |
| Modify | `src/gateway/routes/auth.py:146-151` | Remove old admin login endpoint, add admin guard to admin routes |
| Modify | `src/gateway/middleware.py:8-16` | Change admin auth from API key to JWT `is_admin` check |

### Frontend (MyWeb)

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/api/auth.ts:9-16` | `storeAuthResponse` already stores `account` — no changes needed |
| Modify | `src/api/admin.ts` | Remove separate admin login/key storage, use normal `apiFetch` with JWT auth |
| Modify | `src/tools/admin/AdminPage.tsx` | Remove admin login form, show dashboard directly for admin users |
| Modify | `src/App.tsx:24` | Move `/admin` route inside `RequireAuth` + add `RequireAdmin` guard |

### Config

| Action | File | Change |
|--------|------|--------|
| Modify | `MyAgent/.env.example` | Add `ADMIN_EMAILS=` |
| Modify | `MyWeb/.env.example` | No changes needed |

---

## Chunk 1: Backend — DB and Auth Service

### Task 1: Add `is_admin` column to users table

**Files:**
- Modify: `../MyAgent/src/services/auth/store.py:29-38`

- [ ] **Step 1: Add `is_admin` column to schema and migration**

In `_init_schema`, add the column to the CREATE TABLE statement and add an ALTER TABLE migration for existing databases:

```python
def _init_schema(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id              TEXT PRIMARY KEY,
            email                TEXT UNIQUE NOT NULL,
            password_hash        TEXT,
            encrypted_imap_creds BLOB,
            is_admin             INTEGER NOT NULL DEFAULT 0,
            created_at           REAL NOT NULL,
            updated_at           REAL NOT NULL
        )
    """)
    # Migration for existing databases
    try:
        conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # column already exists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id    TEXT PRIMARY KEY,
            user_id       TEXT NOT NULL,
            mail_engine   TEXT,
            imap_accounts TEXT,
            pending       TEXT,
            created_at    REAL NOT NULL,
            updated_at    REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)
    conn.commit()
```

- [ ] **Step 2: Add `set_admin()` and `get_is_admin()` methods to UserStore**

```python
def set_admin(self, user_id: str, is_admin: bool) -> None:
    now = time.time()
    conn = _connect()
    conn.execute(
        "UPDATE users SET is_admin = ?, updated_at = ? WHERE user_id = ?",
        (1 if is_admin else 0, now, user_id),
    )
    conn.commit()
    conn.close()

def get_is_admin(self, user_id: str) -> bool:
    conn = _connect()
    row = conn.execute(
        "SELECT is_admin FROM users WHERE user_id = ?", (user_id,)
    ).fetchone()
    conn.close()
    return bool(row and row[0])
```

- [ ] **Step 3: Include `is_admin` in user query results**

Update `get_user_by_email` and `get_user_by_id` SELECT statements to include `is_admin`:

`get_user_by_email`:
```python
row = conn.execute(
    "SELECT user_id, email, password_hash, encrypted_imap_creds, is_admin FROM users WHERE email = ?",
    (email.lower(),),
).fetchone()
# ...
return {
    "user_id": row[0],
    "email": row[1],
    "password_hash": row[2],
    "encrypted_imap_creds": row[3],
    "is_admin": bool(row[4]),
}
```

`get_user_by_id`:
```python
row = conn.execute(
    "SELECT user_id, email, password_hash, encrypted_imap_creds, is_admin FROM users WHERE user_id = ?",
    (user_id,),
).fetchone()
# ...
return {
    "user_id": row[0],
    "email": row[1],
    "password_hash": row[2],
    "encrypted_imap_creds": row[3],
    "is_admin": bool(row[4]),
}
```

Also update `list_users` to include `is_admin`:
```python
def list_users(self) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT user_id, email, is_admin, created_at, updated_at FROM users"
    ).fetchall()
    conn.close()
    return [
        {"user_id": r[0], "email": r[1], "is_admin": bool(r[2]), "created_at": r[3], "updated_at": r[4]}
        for r in rows
    ]
```

- [ ] **Step 4: Commit**

```bash
cd ../MyAgent
git add src/services/auth/store.py
git commit -m "feat: add is_admin column to users table with migration"
```

---

### Task 2: Add `ADMIN_EMAILS` config

**Files:**
- Modify: `../MyAgent/src/core/config.py:14`
- Modify: `../MyAgent/.env.example`

- [ ] **Step 1: Add ADMIN_EMAILS to config.py**

After the `JWT_EXPIRY_HOURS` line (~line 17), add:

```python
# Comma-separated list of emails that are auto-promoted to admin on login
ADMIN_EMAILS: list[str] = [
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
]
```

- [ ] **Step 2: Add to .env.example**

Add after the `MYDEVTEAM_API_KEY` line:

```
# Comma-separated emails that are auto-promoted to admin on login
ADMIN_EMAILS=
```

- [ ] **Step 3: Commit**

```bash
git add src/core/config.py .env.example
git commit -m "feat: add ADMIN_EMAILS env var for bootstrapping admin users"
```

---

### Task 3: Auto-promote admin on login/register

**Files:**
- Modify: `../MyAgent/src/services/auth/service.py:33-77`

- [ ] **Step 1: Update `register()` to check ADMIN_EMAILS**

```python
def register(self, email: str, password: str) -> AuthResult:
    existing = self._store.get_user_by_email(email)
    if existing:
        raise UserExistsError(f"User {email} already exists")
    user_id = self._store.create_user(email, password)
    # Auto-promote if email is in ADMIN_EMAILS
    from src.core.config import ADMIN_EMAILS
    is_admin = email.lower() in ADMIN_EMAILS
    if is_admin:
        self._store.set_admin(user_id, True)
    token = create_session_token(user_id, enc_key="")
    self._session_store.create_session(user_id)
    account = "admin" if is_admin else "user"
    return AuthResult(user_id=user_id, token=token, account=account)
```

- [ ] **Step 2: Update `login()` to check ADMIN_EMAILS and DB flag**

At the end of `login()`, after creating the session, replace the return statement:

```python
    # Auto-promote if email is in ADMIN_EMAILS but not yet flagged
    from src.core.config import ADMIN_EMAILS
    is_admin = user.get("is_admin", False)
    if not is_admin and user["email"].lower() in ADMIN_EMAILS:
        self._store.set_admin(user["user_id"], True)
        is_admin = True
    session_id = self._session_store.create_session(user["user_id"], imap_accounts=imap_accounts or None)
    token = create_session_token(user["user_id"], enc_key=password)
    account = "admin" if is_admin else "user"
    return AuthResult(user_id=user["user_id"], token=token, account=account)
```

- [ ] **Step 3: Commit**

```bash
git add src/services/auth/service.py
git commit -m "feat: auto-promote users to admin based on ADMIN_EMAILS env var"
```

---

### Task 4: Update admin route auth — JWT instead of API key

**Files:**
- Modify: `../MyAgent/src/gateway/middleware.py:8-16`
- Modify: `../MyAgent/src/gateway/routes/auth.py:144-151`

- [ ] **Step 1: Add `jwt_admin_required` helper to middleware**

```python
def jwt_admin_required(request: Request) -> dict:
    """Validate JWT and check is_admin flag. Raises HTTPException if not admin."""
    payload = jwt_required(request)
    from src.services.auth.store import UserStore
    store = UserStore()
    if not store.get_is_admin(payload["user_id"]):
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload
```

- [ ] **Step 2: Update `require_api_key` middleware to use JWT for admin routes**

Replace the existing `require_api_key` function:

```python
def require_api_key(request: Request, call_next):
    """Validate admin endpoints via JWT is_admin check."""
    if request.url.path.startswith("/api/admin"):
        # Admin endpoints require JWT with is_admin flag
        # Let the route handlers do the check via jwt_admin_required
        pass
    return call_next(request)
```

- [ ] **Step 3: Remove old admin login endpoint, guard admin routes with JWT**

In `auth.py`, remove the `admin_login` endpoint and add `jwt_admin_required` to all admin routes:

```python
# ── Admin endpoints ─────────────────────────────────────────────────────────────

@router.get("/api/admin/stats")
async def admin_stats(request: Request):
    jwt_admin_required(request)
    from src.services.auth.store import UserStore
    store = UserStore()
    return JSONResponse(content={
        "users_count": store.count_users(),
        "sessions_count": _session_store.count_sessions(),
        "db_size_bytes": _get_db_size(),
    })


@router.get("/api/admin/users")
async def admin_list_users(request: Request):
    jwt_admin_required(request)
    from src.services.auth.store import UserStore
    store = UserStore()
    return JSONResponse(content=store.list_users())


@router.get("/api/admin/sessions")
async def admin_list_sessions(request: Request):
    jwt_admin_required(request)
    return JSONResponse(content=_session_store.list_sessions())


@router.delete("/api/admin/users/{user_id}")
async def admin_delete_user(request: Request, user_id: str):
    jwt_admin_required(request)
    success = _auth_service.delete_user(user_id)
    if not success:
        return JSONResponse(status_code=404, content={"detail": "User not found"})
    return JSONResponse(content={"status": "deleted"})


@router.delete("/api/admin/sessions/{session_id}")
async def admin_delete_session(request: Request, session_id: str):
    jwt_admin_required(request)
    _session_store.delete_session(session_id)
    return JSONResponse(content={"status": "deleted"})
```

Update the import at the top of `auth.py`:
```python
from src.gateway.middleware import jwt_required, jwt_admin_required, get_session_id
```

- [ ] **Step 4: Commit**

```bash
git add src/gateway/middleware.py src/gateway/routes/auth.py
git commit -m "feat: replace API-key admin auth with JWT is_admin check"
```

---

## Chunk 2: Frontend — Remove Separate Admin Login

### Task 5: Simplify admin API client to use normal auth

**Files:**
- Modify: `/home/alex/projects/MyWeb/src/api/admin.ts`

- [ ] **Step 1: Replace admin.ts with JWT-authenticated version**

Remove `adminFetch`, `getAdminApiKey`, `setAdminApiKey`, `adminLogin` and use `apiFetch` from `client.ts`:

```typescript
import { apiFetch } from "./client";

export interface AdminStats {
  user_count?: number;
  users?: number;
  users_count?: number;
  session_count?: number;
  sessions?: number;
  sessions_count?: number;
  db_size?: number;
  db_size_bytes?: number;
  [key: string]: unknown;
}

export interface AdminUser {
  user_id?: string;
  id?: string;
  email?: string;
  is_admin?: boolean;
  created_at?: string | number;
  updated_at?: string | number;
  [key: string]: unknown;
}

export interface AdminSession {
  session_id?: string;
  id?: string;
  user_id?: string;
  email?: string;
  has_mail?: boolean;
  has_mail_engine?: boolean;
  created_at?: string | number;
  updated_at?: string | number;
  [key: string]: unknown;
}

export function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/api/admin/stats", { method: "GET" });
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const data = await apiFetch<AdminUser[] | { users?: AdminUser[] }>("/api/admin/users", { method: "GET" });
  return Array.isArray(data) ? data : data.users ?? [];
}

export async function listAdminSessions(): Promise<AdminSession[]> {
  const data = await apiFetch<AdminSession[] | { sessions?: AdminSession[] }>("/api/admin/sessions", { method: "GET" });
  return Array.isArray(data) ? data : data.sessions ?? [];
}

export function deleteAdminUser(userId: string): Promise<unknown> {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export function deleteAdminSession(sessionId: string): Promise<unknown> {
  return apiFetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/alex/projects/MyWeb
git add src/api/admin.ts
git commit -m "refactor: admin API uses JWT auth instead of separate admin key"
```

---

### Task 6: Update AdminPage — remove login form

**Files:**
- Modify: `/home/alex/projects/MyWeb/src/tools/admin/AdminPage.tsx`

- [ ] **Step 1: Simplify AdminPage to remove login form**

Remove all admin login state/form. The page now assumes the user is authenticated and admin (route guard handles access control):

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  deleteAdminSession,
  deleteAdminUser,
  getAdminStats,
  listAdminSessions,
  listAdminUsers,
  type AdminSession,
  type AdminStats,
  type AdminUser,
} from "../../api/admin";

function displayDate(value: string | number | undefined): string {
  if (value === undefined || value === "") return "unknown";
  if (typeof value === "number") return new Date(value * 1000).toLocaleString();
  return value;
}

function userId(user: AdminUser): string {
  return user.user_id ?? user.id ?? "";
}

function sessionId(session: AdminSession): string {
  return session.session_id ?? session.id ?? "";
}

function formatBytes(value: unknown): string {
  if (typeof value !== "number") return "unknown";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const statCards = useMemo(() => {
    const userCount = stats?.users_count ?? stats?.user_count ?? stats?.users ?? users.length;
    const sessionCount = stats?.sessions_count ?? stats?.session_count ?? stats?.sessions ?? sessions.length;
    const dbSize = stats?.db_size_bytes ?? stats?.db_size;
    return [
      { label: "Users", value: String(userCount ?? 0) },
      { label: "Sessions", value: String(sessionCount ?? 0) },
      { label: "Database", value: formatBytes(dbSize) },
    ];
  }, [sessions.length, stats, users.length]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdminStats(), listAdminUsers(), listAdminSessions()])
      .then(([nextStats, nextUsers, nextSessions]) => {
        if (cancelled) return;
        setStats(nextStats);
        setUsers(nextUsers);
        setSessions(nextSessions);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load admin data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function refreshAdminData() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [nextStats, nextUsers, nextSessions] = await Promise.all([
        getAdminStats(), listAdminUsers(), listAdminSessions(),
      ]);
      setStats(nextStats);
      setUsers(nextUsers);
      setSessions(nextSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUser(id: string, email?: string) {
    if (!id) return;
    if (!window.confirm(`Delete user ${email || id} and all related data?`)) return;
    setLoading(true);
    setError("");
    try {
      await deleteAdminUser(id);
      setNotice(`Deleted user ${email || id}.`);
      await refreshAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSession(id: string) {
    if (!id) return;
    if (!window.confirm(`Kill session ${id}?`)) return;
    setLoading(true);
    setError("");
    try {
      await deleteAdminSession(id);
      setNotice(`Deleted session ${id}.`);
      await refreshAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-header">
        <h1>Admin</h1>
        <p>Inspect users, sessions, and database health.</p>
      </div>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      {notice ? <p className="admin-notice">{notice}</p> : null}

      <div className="admin-toolbar">
        <button type="button" onClick={() => void refreshAdminData()} disabled={loading}>refresh</button>
      </div>

      <div className="admin-stats" aria-label="Admin stats">
        {statCards.map((card) => (
          <div key={card.label} className="admin-stat-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <section className="admin-section">
        <h2>Users</h2>
        {users.length > 0 ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>User ID</th>
                  <th>Admin</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const id = userId(user);
                  return (
                    <tr key={id || user.email}>
                      <td>{user.email || "unknown"}</td>
                      <td>{id || "unknown"}</td>
                      <td>{user.is_admin ? "yes" : "no"}</td>
                      <td>{displayDate(user.created_at)}</td>
                      <td>{displayDate(user.updated_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-danger-btn"
                          onClick={() => void handleDeleteUser(id, user.email)}
                          disabled={loading || !id}
                        >
                          delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No users loaded.</p>
        )}
      </section>

      <section className="admin-section">
        <h2>Sessions</h2>
        {sessions.length > 0 ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>User</th>
                  <th>Mail</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const id = sessionId(session);
                  const hasMail = session.has_mail ?? session.has_mail_engine ?? false;
                  return (
                    <tr key={id || session.user_id}>
                      <td>{id || "unknown"}</td>
                      <td>{session.email || session.user_id || "unknown"}</td>
                      <td>{hasMail ? "yes" : "no"}</td>
                      <td>{displayDate(session.created_at)}</td>
                      <td>{displayDate(session.updated_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-danger-btn"
                          onClick={() => void handleDeleteSession(id)}
                          disabled={loading || !id}
                        >
                          kill
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No sessions loaded.</p>
        )}
      </section>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/admin/AdminPage.tsx
git commit -m "refactor: remove admin login form, admin access via user session"
```

---

### Task 7: Add `RequireAdmin` route guard

**Files:**
- Modify: `/home/alex/projects/MyWeb/src/App.tsx`

- [ ] **Step 1: Add RequireAdmin guard and move /admin inside authenticated routes**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./tools/HomePage";
import MailPage from "./tools/mail/MailPage";
import SearchPage from "./tools/search/SearchPage";
import ChatPage from "./tools/chat/ChatPage";
import MemoryPage from "./tools/memory/MemoryPage";
import MyAgentPage from "./tools/myagent/MyAgentPage";
import DevTeamPage from "./tools/devteam/DevTeamPage";
import AdminPage from "./tools/admin/AdminPage";
import LoginPage from "./tools/LoginPage";
import SettingsPage from "./tools/SettingsPage";
import { isAuthenticated, isAdmin } from "./api/auth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  return isAdmin() ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/mail" element={<MailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/myagent" element={<MyAgentPage />} />
          <Route path="/devteam" element={<DevTeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add RequireAdmin guard, move /admin inside authenticated routes"
```

---

### Task 8: Update tests

**Files:**
- Modify: `/home/alex/projects/MyWeb/src/api/admin.test.ts`
- Modify: `/home/alex/projects/MyWeb/src/api/auth.test.ts`

- [ ] **Step 1: Update admin.test.ts to remove admin login/key tests**

Remove tests for `getAdminApiKey`, `setAdminApiKey`, `adminLogin`. Update remaining tests to match new imports:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getAdminStats,
  listAdminUsers,
  listAdminSessions,
  deleteAdminUser,
  deleteAdminSession,
} from "./admin";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(status === 204 ? "" : JSON.stringify(data)),
  } as Response);
}

describe("admin API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  describe("getAdminStats", () => {
    it("calls GET /api/admin/stats", async () => {
      mockFetch.mockResolvedValue(mockResponse({ users: 5, sessions: 10 }));
      await getAdminStats();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/stats"),
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("listAdminUsers", () => {
    it("returns array directly when response is array", async () => {
      mockFetch.mockResolvedValue(mockResponse([{ user_id: "u1", email: "a@b.com" }]));
      const result = await listAdminUsers();
      expect(result).toHaveLength(1);
    });

    it("extracts users array when wrapped in object", async () => {
      mockFetch.mockResolvedValue(mockResponse({ users: [{ user_id: "u2" }] }));
      const result = await listAdminUsers();
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe("u2");
    });
  });

  describe("listAdminSessions", () => {
    it("returns array directly when response is array", async () => {
      mockFetch.mockResolvedValue(mockResponse([{ session_id: "s1" }]));
      const result = await listAdminSessions();
      expect(result).toHaveLength(1);
    });

    it("extracts sessions array when wrapped in object", async () => {
      mockFetch.mockResolvedValue(mockResponse({ sessions: [{ session_id: "s2" }] }));
      const result = await listAdminSessions();
      expect(result).toHaveLength(1);
    });
  });

  describe("deleteAdminUser", () => {
    it("calls DELETE /api/admin/users/{id}", async () => {
      mockFetch.mockResolvedValue(mockResponse(undefined, 204));
      await deleteAdminUser("user-123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/users/user-123"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("deleteAdminSession", () => {
    it("calls DELETE /api/admin/sessions/{id}", async () => {
      mockFetch.mockResolvedValue(mockResponse(undefined, 204));
      await deleteAdminSession("sess-456");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/sessions/sess-456"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
```

- [ ] **Step 2: Add isAdmin test to auth.test.ts**

Add a new describe block to the existing auth tests:

```typescript
describe("isAdmin", () => {
  it("returns false when account is not admin", () => {
    localStorage.setItem("myagent.account", "user");
    expect(isAdmin()).toBe(false);
  });

  it("returns true when account is admin", () => {
    localStorage.setItem("myagent.account", "admin");
    expect(isAdmin()).toBe(true);
  });

  it("returns false when account is not set", () => {
    expect(isAdmin()).toBe(false);
  });
});
```

Update the import to include `isAdmin`:
```typescript
import {
  loginAccount,
  registerAccount,
  isAuthenticated,
  isAdmin,
  getSessionId,
  logout,
  storeAuthResponse,
} from "./auth";
```

- [ ] **Step 3: Run tests**

```bash
cd /home/alex/projects/MyWeb
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/api/admin.test.ts src/api/auth.test.ts
git commit -m "test: update admin/auth tests for JWT-based admin system"
```

---

### Task 9: Update documentation

**Files:**
- Modify: `/home/alex/projects/MyWeb/README.md`
- Modify: `/home/alex/projects/MyAgent/.env.example`

- [ ] **Step 1: Update README admin section**

Find the admin section in README.md and update to reflect:
- Admin is now a user account property, not a separate login
- Set `ADMIN_EMAILS=you@example.com` in MyAgent's `.env`
- Log in normally — admin features appear automatically
- `/admin` route is behind `RequireAuth` + `RequireAdmin`

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for new admin user system"
```
