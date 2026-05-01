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
    const userCount = stats?.user_count ?? stats?.users ?? users.length;
    const sessionCount = stats?.session_count ?? stats?.sessions ?? sessions.length;
    const dbSize = stats?.db_size_bytes ?? stats?.db_size;
    return [
      { label: "Users", value: String(userCount ?? 0) },
      { label: "Sessions", value: String(sessionCount ?? 0) },
      { label: "Database", value: formatBytes(dbSize) },
    ];
  }, [sessions.length, stats, users.length]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAdminStats(),
      listAdminUsers(),
      listAdminSessions(),
    ])
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
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshAdminData() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [nextStats, nextUsers, nextSessions] = await Promise.all([
        getAdminStats(),
        listAdminUsers(),
        listAdminSessions(),
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
