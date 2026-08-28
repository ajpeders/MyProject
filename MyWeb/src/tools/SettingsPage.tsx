import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  listImapAccounts,
  addImapAccount,
  deleteImapAccount,
  type ImapAccount,
} from "../api/imap";
import { getMailConfig, setMailAIConfig } from "../api/mailConfig";
import {
  listAIConfigs,
  createAIConfig,
  updateAIConfig,
  deleteAIConfig,
  type AIConfig,
  type AIProvider,
} from "../api/aiConfigs";
import { isAuthenticated } from "../api/auth";
import { ApiError } from "../api/client";

type SettingsTab = "ai" | "mail";

const TAB_FROM_HASH: Record<string, SettingsTab> = { "#ai": "ai", "#mail": "mail" };

function initialTab(): SettingsTab {
  if (typeof window === "undefined") return "ai";
  return TAB_FROM_HASH[window.location.hash] ?? "ai";
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState(false);

  // ── AI tab ──
  const [aiConfigs, setAIConfigs] = useState<AIConfig[]>([]);
  const [aiLoadError, setAILoadError] = useState("");
  const [aiFormOpen, setAIFormOpen] = useState(false);
  const [aiEditingId, setAIEditingId] = useState<string | null>(null);
  const [aiName, setAIName] = useState("");
  const [aiProvider, setAIProvider] = useState<AIProvider>("ollama");
  const [aiHost, setAIHost] = useState("");
  const [aiApiKey, setAIApiKey] = useState("");
  const [aiModel, setAIModel] = useState("");
  const [aiFormError, setAIFormError] = useState("");
  const [aiSaving, setAISaving] = useState(false);
  const [aiConfirmDeleteId, setAIConfirmDeleteId] = useState<string | null>(null);

  // ── Mail tab ──
  const [accounts, setAccounts] = useState<ImapAccount[]>([]);
  const [deleteError, setDeleteError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newServer, setNewServer] = useState("");
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [mailAIConfigId, setMailAIConfigId] = useState<string | null>(null);
  const [mailAIError, setMailAIError] = useState("");
  const [mailAINotice, setMailAINotice] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    let cancelled = false;
    listImapAccounts()
      .then((data) => { if (!cancelled) setAccounts(data); })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) { setAuthError(true); setError(""); }
          else { setError(err instanceof Error ? err.message : "Failed to load accounts"); }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    listAIConfigs()
      .then((data) => { if (!cancelled) setAIConfigs(data); })
      .catch((err) => { if (!cancelled) setAILoadError(err instanceof Error ? err.message : "Failed to load AI configs"); });
    getMailConfig()
      .then((data) => { if (!cancelled) setMailAIConfigId(data.ai_config_id); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    function onHash() {
      const next = TAB_FROM_HASH[window.location.hash];
      if (next) setTab(next);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function switchTab(next: SettingsTab) {
    setTab(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${next}`);
    }
  }

  // ── AI tab handlers ─────────────────────────────────────

  function openAddForm() {
    setAIEditingId(null);
    setAIName("");
    setAIProvider("ollama");
    setAIHost("");
    setAIApiKey("");
    setAIModel("");
    setAIFormError("");
    setAIFormOpen(true);
  }

  function openEditForm(cfg: AIConfig) {
    setAIEditingId(cfg.id);
    setAIName(cfg.name);
    setAIProvider(cfg.provider);
    setAIHost(cfg.host);
    setAIApiKey("");
    setAIModel(cfg.model);
    setAIFormError("");
    setAIFormOpen(true);
  }

  async function handleSaveAIConfig(e: FormEvent) {
    e.preventDefault();
    setAISaving(true);
    setAIFormError("");
    try {
      if (aiEditingId) {
        const body: { name: string; host?: string; model: string; api_key?: string } = {
          name: aiName,
          model: aiModel,
        };
        if (aiProvider === "ollama" || aiProvider === "openai_compatible") body.host = aiHost;
        if (aiApiKey) body.api_key = aiApiKey;
        const updated = await updateAIConfig(aiEditingId, body);
        setAIConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const body: { name: string; provider: AIProvider; host?: string; model: string; api_key?: string } = {
          name: aiName,
          provider: aiProvider,
          model: aiModel,
        };
        if (aiProvider === "ollama" || aiProvider === "openai_compatible") body.host = aiHost;
        if (aiApiKey) body.api_key = aiApiKey;
        const created = await createAIConfig(body);
        setAIConfigs((prev) => [...prev, created]);
      }
      setAIFormOpen(false);
    } catch (err) {
      setAIFormError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setAISaving(false);
    }
  }

  async function handleDeleteAIConfig(id: string) {
    try {
      await deleteAIConfig(id);
      setAIConfigs((prev) => prev.filter((c) => c.id !== id));
      if (mailAIConfigId === id) setMailAIConfigId(null);
      setAIConfirmDeleteId(null);
    } catch (err) {
      setAILoadError(err instanceof Error ? err.message : "Failed to delete config");
    }
  }

  // ── Mail tab handlers ───────────────────────────────────

  async function handleAddAccount(e: FormEvent) {
    e.preventDefault(); setAddError(""); setAdding(true);
    try {
      const acc = await addImapAccount(newName, newServer, newUser, newPass);
      setAccounts((p) => [...p, acc]); setShowAdd(false);
      setNewName(""); setNewServer(""); setNewUser(""); setNewPass("");
    } catch (err) { setAddError(err instanceof Error ? err.message : "Failed to add"); }
    finally { setAdding(false); }
  }

  async function handleDeleteAccount(id: string) {
    setDeleteError("");
    try { await deleteImapAccount(id); setAccounts((p) => p.filter((a) => a.id !== id)); setConfirmDeleteId(null); }
    catch (err) { setDeleteError(err instanceof Error ? err.message : "Failed to delete"); }
  }

  async function handleMailAIConfigChange(value: string) {
    const next = value || null;
    setMailAIConfigId(next);
    setMailAIError("");
    setMailAINotice("");
    try {
      await setMailAIConfig(next);
      setMailAINotice(next ? "Saved AI config for Mail." : "Cleared AI config for Mail.");
    } catch (err) {
      setMailAIError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  const showHostField = aiProvider === "ollama" || aiProvider === "openai_compatible";
  const showApiKeyField = aiProvider === "openai" || aiProvider === "anthropic" || aiProvider === "openai_compatible";
  const modelPlaceholder = aiProvider === "ollama"
    ? "qwen3:8b"
    : aiProvider === "openai"
      ? "gpt-4o-mini"
      : aiProvider === "anthropic"
        ? "claude-haiku-4-5-20251001"
        : "model name";
  const hostPlaceholder = aiProvider === "ollama" ? "http://192.168.1.40:11434" : "https://api.example.com/v1";

  return (
    <section className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

      {authError && (
        <div className="settings-auth-error">
          <p>Session expired — please <a href="/login">log in</a> again.</p>
        </div>
      )}

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "ai"}
          className={tab === "ai" ? "settings-tab is-active" : "settings-tab"}
          onClick={() => switchTab("ai")}
        >
          AI
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mail"}
          className={tab === "mail" ? "settings-tab is-active" : "settings-tab"}
          onClick={() => switchTab("mail")}
        >
          Mail
        </button>
      </div>

      {/* ── AI ────────────────────────────────── */}
      {tab === "ai" && (
        <div className="settings-panel">
          <h2>AI Configs</h2>
          <p className="settings-panel-desc">Per-user AI providers. Tools (like Mail) pick one of these by name.</p>

          {aiLoadError ? <p className="settings-error">{aiLoadError}</p> : null}

          {aiConfigs.length > 0 ? (
            <div className="settings-list">
              {aiConfigs.map((cfg) => (
                <div key={cfg.id} className="settings-list-item">
                  <div className="settings-list-item-info">
                    <strong>{cfg.name}</strong>
                    <span className="settings-meta">
                      <span className="settings-tag">{cfg.provider}</span>
                      <span>{cfg.model}</span>
                      {cfg.host ? <span>{cfg.host}</span> : null}
                      {cfg.has_api_key ? <span className="settings-tag">has API key</span> : null}
                    </span>
                  </div>
                  <div className="settings-list-item-actions">
                    {aiConfirmDeleteId === cfg.id ? (
                      <span className="settings-confirm-delete">
                        Delete?
                        <button type="button" onClick={() => void handleDeleteAIConfig(cfg.id)} className="delete-btn">Yes</button>
                        <button type="button" onClick={() => setAIConfirmDeleteId(null)} className="cancel-btn">No</button>
                      </span>
                    ) : (
                      <>
                        <button type="button" onClick={() => openEditForm(cfg)}>Edit</button>
                        <button type="button" onClick={() => setAIConfirmDeleteId(cfg.id)} className="delete-btn">Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !aiFormOpen ? (
            <p className="settings-hint">No AI configs yet. Add one to use with Mail or other tools.</p>
          ) : null}

          {aiFormOpen ? (
            <div className="settings-sub-card">
              <h3>{aiEditingId ? "Edit AI Config" : "Add AI Config"}</h3>
              <form className="settings-form-stack" onSubmit={handleSaveAIConfig}>
                <label>Name <input type="text" value={aiName} onChange={(e) => setAIName(e.target.value)} required placeholder="e.g. Local llama" /></label>
                <label>Provider
                  <select
                    value={aiProvider}
                    onChange={(e) => setAIProvider(e.target.value as AIProvider)}
                    disabled={aiEditingId !== null}
                  >
                    <option value="ollama">Ollama</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openai_compatible">OpenAI-compatible</option>
                  </select>
                </label>
                {showHostField ? (
                  <label>Host
                    <input
                      type="text"
                      value={aiHost}
                      onChange={(e) => setAIHost(e.target.value)}
                      placeholder={hostPlaceholder}
                      required={aiProvider === "openai_compatible"}
                    />
                  </label>
                ) : null}
                {showApiKeyField ? (
                  <label>API Key
                    <input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAIApiKey(e.target.value)}
                      placeholder={aiEditingId ? "•••••• (unchanged)" : "sk-..."}
                    />
                  </label>
                ) : null}
                <label>Model <input type="text" value={aiModel} onChange={(e) => setAIModel(e.target.value)} required placeholder={modelPlaceholder} /></label>
                {aiFormError && <p className="settings-error">{aiFormError}</p>}
                <div className="settings-form-actions">
                  <button type="submit" disabled={aiSaving}>{aiSaving ? "Saving..." : "Save"}</button>
                  <button type="button" className="settings-btn-ghost" onClick={() => setAIFormOpen(false)}>Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            <button type="button" onClick={openAddForm} className="settings-btn-outline">+ Add AI Config</button>
          )}
        </div>
      )}

      {/* ── Mail ────────────────────────────────── */}
      {tab === "mail" && (
        <div className="settings-panel">
          <h2>Mail</h2>

          <div className="settings-field">
            <label htmlFor="mail-ai-config">AI Config</label>
            {aiConfigs.length === 0 ? (
              <p className="settings-hint">
                No AI configs yet. <a href="#ai" onClick={(e) => { e.preventDefault(); switchTab("ai"); }}>Create an AI config first</a>.
              </p>
            ) : (
              <select
                id="mail-ai-config"
                value={mailAIConfigId ?? ""}
                onChange={(e) => void handleMailAIConfigChange(e.target.value)}
              >
                <option value="">(server default)</option>
                {aiConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
                ))}
              </select>
            )}
            {mailAINotice ? <p className="settings-notice">{mailAINotice}</p> : null}
            {mailAIError ? <p className="settings-error">{mailAIError}</p> : null}
          </div>

          <div className="settings-field">
            <label>IMAP Accounts</label>
            {loading ? <p className="settings-hint">Loading...</p> : error ? <p className="settings-error">{error}</p> : (
              <>
                {deleteError && <p className="settings-error">{deleteError}</p>}
                {accounts.length > 0 ? (
                  <div className="settings-list">
                    {accounts.map((acc) => (
                      <div key={acc.id} className="settings-list-item">
                        <div className="settings-list-item-info">
                          <strong>{acc.name}</strong>
                          <span className="settings-meta">{acc.server} / {acc.username}</span>
                        </div>
                        <div className="settings-list-item-actions">
                          {confirmDeleteId === acc.id ? (
                            <span className="settings-confirm-delete">
                              Delete?
                              <button type="button" onClick={() => void handleDeleteAccount(acc.id)} className="delete-btn">Yes</button>
                              <button type="button" onClick={() => setConfirmDeleteId(null)} className="cancel-btn">No</button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => setConfirmDeleteId(acc.id)} className="delete-btn">Delete</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="settings-hint">No IMAP accounts configured.</p>}

                {showAdd ? (
                  <div className="settings-sub-card">
                    <h3>Add IMAP Account</h3>
                    <form className="settings-form-stack" onSubmit={handleAddAccount}>
                      <label>Account Name <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Gmail personal" /></label>
                      <label>IMAP Server <input type="text" value={newServer} onChange={(e) => setNewServer(e.target.value)} required placeholder="imap.gmail.com" /></label>
                      <label>Username <input type="text" value={newUser} onChange={(e) => setNewUser(e.target.value)} required placeholder="you@gmail.com" /></label>
                      <label>Password (app password) <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required placeholder="••••••••" /></label>
                      {addError && <p className="settings-error">{addError}</p>}
                      <div className="settings-form-actions">
                        <button type="submit" disabled={adding}>{adding ? "Adding..." : "Add Account"}</button>
                        <button type="button" className="settings-btn-ghost" onClick={() => { setShowAdd(false); setAddError(""); }}>Cancel</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowAdd(true)} className="settings-btn-outline">+ Add IMAP Account</button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
