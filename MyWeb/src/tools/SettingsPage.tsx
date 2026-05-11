import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  listImapAccounts,
  addImapAccount,
  deleteImapAccount,
  type ImapAccount,
} from "../api/imap";
import { getMailConfig, updateMailConfig } from "../api/mailConfig";
import {
  isAuthenticated,
  isAdmin,
  createOrRotateDeviceToken,
  getDeviceTokenMeta,
  revokeDeviceToken,
  type DeviceTokenMeta,
} from "../api/auth";
import { getApiKey, setApiKey as saveApiKey, ApiError } from "../api/client";
import { TOPICS, type NewsTopic } from "./news/sources";
import {
  getSources,
  createSource,
  updateSource as apiUpdateSource,
  deleteSource as apiDeleteSource,
  seedDefaults,
  type NewsSource,
} from "../api/news";
import { getProfile, updateInterests } from "../api/profile";

type SettingsTab = "general" | "mail" | "news";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SettingsTab>("general");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState(false);

  // General
  const [apiKey, setApiKey] = useState(getApiKey);
  const [apiKeyNotice, setApiKeyNotice] = useState("");

  // Device token (for iPhone Shortcut)
  const [tokenMeta, setTokenMeta] = useState<DeviceTokenMeta | null>(null);
  const [tokenPlaintext, setTokenPlaintext] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);

  // Profile
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");
  const [interestsError, setInterestsError] = useState("");

  // Mail
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
  const [mailModel, setMailModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showMailModelOptions, setShowMailModelOptions] = useState(false);
  const [mailModelNotice, setMailModelNotice] = useState("");
  const [mailModelError, setMailModelError] = useState("");
  const [savingMailModel, setSavingMailModel] = useState(false);

  // News sources (admin)
  const [newsSources, setNewsSources] = useState<NewsSource[]>([]);
  const [newsSourcesLoading, setNewsSourcesLoading] = useState(true);
  const [newsSourcesError, setNewsSourcesError] = useState("");
  const [newsLabel, setNewsLabel] = useState("");
  const [newsTopic, setNewsTopic] = useState<NewsTopic>("Tech");
  const [newsFeedUrl, setNewsFeedUrl] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [confirmDeleteSourceId, setConfirmDeleteSourceId] = useState<string | null>(null);

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
    getMailConfig()
      .then((data) => { if (!cancelled) { setMailModel(data.mail_model); setAvailableModels(data.available_models); } })
      .catch((err) => { if (!cancelled && !(err instanceof ApiError && err.status === 401)) setMailModelError(err instanceof Error ? err.message : "Failed to load mail model"); });
    getProfile()
      .then((data) => { if (!cancelled) setInterests(data.interests); })
      .catch(() => {});
    getDeviceTokenMeta()
      .then((meta) => { if (!cancelled) setTokenMeta(meta); })
      .catch(() => {});
    if (isAdmin()) {
      getSources()
        .then((data) => { if (!cancelled) setNewsSources(data.sources); })
        .catch((err) => { if (!cancelled) setNewsSourcesError(err instanceof Error ? err.message : "Failed to load news sources"); })
        .finally(() => { if (!cancelled) setNewsSourcesLoading(false); });
    } else { setNewsSourcesLoading(false); }
    return () => { cancelled = true; };
  }, [navigate]);

  // ── Handlers ──────────────────────────────────────

  function handleApiKeySave(e: FormEvent) {
    e.preventDefault();
    saveApiKey(apiKey);
    setApiKeyNotice(apiKey.trim() ? "API key saved." : "API key cleared.");
  }

  async function handleGenerateToken() {
    setTokenBusy(true);
    setTokenError("");
    try {
      const result = await createOrRotateDeviceToken();
      setTokenPlaintext(result.token);
      setTokenMeta({ exists: true, last4: result.last4, created_at: result.created_at, last_used_at: null });
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setTokenBusy(false);
    }
  }

  async function handleRevokeToken() {
    setTokenBusy(true);
    setTokenError("");
    try {
      await revokeDeviceToken();
      setTokenMeta({ exists: false });
      setTokenPlaintext("");
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Failed to revoke token");
    } finally {
      setTokenBusy(false);
    }
  }

  function handleCopyToken() {
    if (!tokenPlaintext) return;
    void navigator.clipboard?.writeText(tokenPlaintext);
  }

  function handleDismissToken() {
    setTokenPlaintext("");
  }

  async function handleAddInterest(e: FormEvent) {
    e.preventDefault();
    const trimmed = newInterest.trim();
    if (!trimmed || interests.includes(trimmed)) return;
    const updated = [...interests, trimmed];
    setInterests(updated);
    setNewInterest("");
    setInterestsError("");
    try { await updateInterests(updated); }
    catch (err) { setInterestsError(err instanceof Error ? err.message : "Failed to update"); }
  }

  async function handleRemoveInterest(interest: string) {
    const updated = interests.filter((i) => i !== interest);
    setInterests(updated);
    try { await updateInterests(updated); }
    catch (err) { setInterestsError(err instanceof Error ? err.message : "Failed to update"); }
  }

  async function handleMailModelSave(e: FormEvent) {
    e.preventDefault();
    setSavingMailModel(true); setMailModelError(""); setMailModelNotice("");
    try {
      const r = await updateMailConfig(mailModel);
      setMailModel(r.mail_model); setAvailableModels(r.available_models);
      setMailModelNotice(`Saved: ${r.mail_model}`);
    } catch (err) { setMailModelError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setSavingMailModel(false); }
  }

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

  async function handleAddNewsSource(e: FormEvent) {
    e.preventDefault();
    const label = newsLabel.trim(), url = newsFeedUrl.trim();
    if (!label || !url) return;
    setAddingSource(true); setNewsSourcesError("");
    try {
      const s = await createSource(label, newsTopic, url);
      setNewsSources((c) => [...c, s]); setNewsLabel(""); setNewsFeedUrl("");
    } catch (err) { setNewsSourcesError(err instanceof Error ? err.message : "Failed to add"); }
    finally { setAddingSource(false); }
  }

  async function handleToggleNewsSource(id: string) {
    const s = newsSources.find((x) => x.id === id);
    if (!s) return;
    try {
      const u = await apiUpdateSource(id, !s.enabled);
      setNewsSources((c) => c.map((x) => (x.id === id ? u : x)));
    } catch (err) { setNewsSourcesError(err instanceof Error ? err.message : "Failed to update"); }
  }

  async function handleDeleteNewsSource(id: string) {
    try { await apiDeleteSource(id); setNewsSources((c) => c.filter((x) => x.id !== id)); setConfirmDeleteSourceId(null); }
    catch (err) { setNewsSourcesError(err instanceof Error ? err.message : "Failed to delete"); }
  }

  async function handleSeedDefaults() {
    setSeeding(true); setNewsSourcesError("");
    try {
      const r = await seedDefaults();
      if (r.added.length > 0) setNewsSources((c) => [...c, ...r.added]);
    } catch (err) { setNewsSourcesError(err instanceof Error ? err.message : "Failed to load defaults"); }
    finally { setSeeding(false); }
  }

  const filteredModels = availableModels.filter((m) => m.toLowerCase().includes(mailModel.toLowerCase()));
  const tabs: { id: SettingsTab; label: string; admin?: boolean }[] = [
    { id: "general", label: "General" },
    { id: "mail", label: "Mail" },
    { id: "news", label: "News" },
  ];

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
        {tabs.map((t) => {
          if (t.admin && !isAdmin()) return null;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "settings-tab is-active" : "settings-tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── General ─────────────────────────────── */}
      {tab === "general" && (
        <div className="settings-panel">
          <div className="settings-field">
            <label htmlFor="myagent-api-key">API Key</label>
            <form className="settings-inline-form" onSubmit={handleApiKeySave}>
              <input
                id="myagent-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setApiKeyNotice(""); }}
                placeholder="MYDEVTEAM_API_KEY"
              />
              <button type="submit">Save</button>
            </form>
            {apiKeyNotice ? <p className="settings-notice">{apiKeyNotice}</p> : null}
          </div>

          <div className="device-token-section">
            <h2>Whisper device token</h2>
            <p>
              Use this token to call <code>/api/whisper/transcribe</code> from an iPhone Shortcut.
              Treat it like a password.
            </p>

            {tokenError && <p className="settings-error">{tokenError}</p>}

            {tokenMeta?.exists ? (
              <p className="device-token-status">
                ● Active &middot; ····{tokenMeta.last4}
                {tokenMeta.created_at && (
                  <> &middot; created {new Date(tokenMeta.created_at * 1000).toLocaleDateString()}</>
                )}
              </p>
            ) : (
              <p className="device-token-status">○ None</p>
            )}

            <div className="device-token-actions">
              <button type="button" onClick={() => void handleGenerateToken()} disabled={tokenBusy}>
                {tokenMeta?.exists ? "Rotate" : "Generate"}
              </button>
              {tokenMeta?.exists && (
                <button
                  type="button"
                  onClick={() => void handleRevokeToken()}
                  disabled={tokenBusy}
                  className="delete-btn"
                >
                  Revoke
                </button>
              )}
            </div>

            {tokenPlaintext && (
              <div className="device-token-modal" role="alert">
                <p>
                  <strong>Save this now.</strong> You won't see it again.
                </p>
                <pre>{tokenPlaintext}</pre>
                <p className="device-token-warning">Closing this clears the token from this page.</p>
                <div className="device-token-actions">
                  <button type="button" onClick={handleCopyToken}>Copy</button>
                  <button type="button" onClick={handleDismissToken}>I've saved it</button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Mail ────────────────────────────────── */}
      {tab === "mail" && (
        <div className="settings-panel">
          <h2>Mail</h2>

          <div className="settings-field">
            <label htmlFor="mail-model">AI Model</label>
            <div className="settings-mail-model-picker">
              <form className="settings-inline-form" onSubmit={handleMailModelSave}>
                <input
                  id="mail-model"
                  type="text"
                  role="combobox"
                  aria-expanded={showMailModelOptions}
                  aria-controls="mail-model-options"
                  aria-autocomplete="list"
                  value={mailModel}
                  onFocus={() => setShowMailModelOptions(true)}
                  onChange={(e) => { setMailModel(e.target.value); setShowMailModelOptions(true); setMailModelNotice(""); setMailModelError(""); }}
                  placeholder="Search or type a model name"
                />
                <button type="button" onClick={() => setShowMailModelOptions((o) => !o)}>Models</button>
                <button type="submit" disabled={savingMailModel}>{savingMailModel ? "Saving..." : "Save"}</button>
              </form>
              {showMailModelOptions ? (
                <div className="settings-model-options" id="mail-model-options" role="listbox">
                  {filteredModels.length > 0 ? filteredModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      role="option"
                      className={`settings-model-option${model === mailModel ? " active" : ""}`}
                      onClick={() => { setMailModel(model); setShowMailModelOptions(false); setMailModelNotice(""); setMailModelError(""); }}
                    >
                      {model}
                    </button>
                  )) : (
                    <p className="settings-hint" style={{ padding: "0.75rem" }}>No matching models.</p>
                  )}
                </div>
              ) : null}
            </div>
            {mailModelNotice ? <p className="settings-notice">{mailModelNotice}</p> : null}
            {mailModelError ? <p className="settings-error">{mailModelError}</p> : null}
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

      {/* ── News ───────────────────────────────── */}
      {tab === "news" && (
        <div className="settings-panel">
          <div className="settings-field">
            <label>Interests</label>
            <p className="settings-panel-desc">Topics that shape your For You feed.</p>

            {interestsError ? <p className="settings-error">{interestsError}</p> : null}

            <form className="settings-inline-form" onSubmit={handleAddInterest}>
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                placeholder="e.g. AI, hip hop, Rust, gaming"
              />
              <button type="submit" disabled={!newInterest.trim()}>Add</button>
            </form>

            {interests.length > 0 ? (
              <div className="settings-tags" aria-label="Interests">
                {interests.map((interest) => (
                  <span key={interest} className="settings-tag">
                    {interest}
                    <button type="button" aria-label={`Remove ${interest}`} onClick={() => void handleRemoveInterest(interest)}>
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="settings-hint">No interests yet. Add some to get personalized news.</p>
            )}
          </div>

          <div className="settings-field">
            <label htmlFor="news-model">Curation Model</label>
            <div className="settings-mail-model-picker">
              <form className="settings-inline-form" onSubmit={handleMailModelSave}>
                <input
                  id="news-model"
                  type="text"
                  role="combobox"
                  aria-expanded={showMailModelOptions}
                  aria-controls="news-model-options"
                  aria-autocomplete="list"
                  value={mailModel}
                  onFocus={() => setShowMailModelOptions(true)}
                  onChange={(e) => { setMailModel(e.target.value); setShowMailModelOptions(true); setMailModelNotice(""); setMailModelError(""); }}
                  placeholder="Search or type a model name"
                />
                <button type="button" onClick={() => setShowMailModelOptions((o) => !o)}>Models</button>
                <button type="submit" disabled={savingMailModel}>{savingMailModel ? "Saving..." : "Save"}</button>
              </form>
              {showMailModelOptions ? (
                <div className="settings-model-options" id="news-model-options" role="listbox">
                  {filteredModels.length > 0 ? filteredModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      role="option"
                      className={`settings-model-option${model === mailModel ? " active" : ""}`}
                      onClick={() => { setMailModel(model); setShowMailModelOptions(false); setMailModelNotice(""); setMailModelError(""); }}
                    >
                      {model}
                    </button>
                  )) : (
                    <p className="settings-hint" style={{ padding: "0.75rem" }}>No matching models.</p>
                  )}
                </div>
              ) : null}
            </div>
            {mailModelNotice ? <p className="settings-notice">{mailModelNotice}</p> : null}
            {mailModelError ? <p className="settings-error">{mailModelError}</p> : null}
          </div>

          {isAdmin() && <>
          <h3 className="settings-section-divider">Sources</h3>
          <p className="settings-panel-desc">RSS feeds that power the news page for all users.</p>

          {newsSourcesError ? <p className="settings-error">{newsSourcesError}</p> : null}

          <form className="settings-source-form" onSubmit={handleAddNewsSource}>
            <input type="text" value={newsLabel} onChange={(e) => setNewsLabel(e.target.value)} placeholder="Source name" />
            <select value={newsTopic} onChange={(e) => setNewsTopic(e.target.value as NewsTopic)}>
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="url" value={newsFeedUrl} onChange={(e) => setNewsFeedUrl(e.target.value)} placeholder="Feed URL" className="settings-source-url" />
            <button type="submit" disabled={!newsLabel.trim() || !newsFeedUrl.trim() || addingSource}>
              {addingSource ? "Adding..." : "Add"}
            </button>
          </form>

          {newsSourcesLoading ? <p className="settings-hint">Loading sources...</p> : newsSources.length > 0 ? (
            <div className="settings-list">
              {newsSources.map((s) => (
                <div key={s.id} className="settings-list-item">
                  <label className="settings-list-item-toggle">
                    <input type="checkbox" checked={s.enabled} onChange={() => void handleToggleNewsSource(s.id)} />
                    <strong>{s.label}</strong>
                  </label>
                  <span className="settings-tag settings-tag-sm">{s.topic}</span>
                  <a href={s.feed_url} target="_blank" rel="noreferrer" className="settings-meta settings-source-link">{s.feed_url}</a>
                  <div className="settings-list-item-actions">
                    {confirmDeleteSourceId === s.id ? (
                      <span className="settings-confirm-delete">
                        <button type="button" onClick={() => void handleDeleteNewsSource(s.id)} className="delete-btn">Yes</button>
                        <button type="button" onClick={() => setConfirmDeleteSourceId(null)} className="cancel-btn">No</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteSourceId(s.id)} className="delete-btn">Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="settings-hint">No sources configured.</p>}

          <button type="button" onClick={() => void handleSeedDefaults()} disabled={seeding} className="settings-btn-outline">
            {seeding ? "Loading..." : "Load default sources"}
          </button>
          </>}
        </div>
      )}
    </section>
  );
}
