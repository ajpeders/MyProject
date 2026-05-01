import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  listImapAccounts,
  addImapAccount,
  deleteImapAccount,
  type ImapAccount,
} from "../api/imap";
import { getMailConfig, updateMailConfig } from "../api/mailConfig";
import { isAuthenticated, isAdmin } from "../api/auth";
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

export default function SettingsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<ImapAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [apiKey, setApiKey] = useState(getApiKey);
  const [apiKeyNotice, setApiKeyNotice] = useState("");
  const [mailModel, setMailModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showMailModelOptions, setShowMailModelOptions] = useState(false);
  const [mailModelNotice, setMailModelNotice] = useState("");
  const [mailModelError, setMailModelError] = useState("");
  const [savingMailModel, setSavingMailModel] = useState(false);

  // Add account form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newServer, setNewServer] = useState("");
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // News sources
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
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    let cancelled = false;
    listImapAccounts()
      .then((data) => {
        if (!cancelled) setAccounts(data);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) {
            setAuthError(true);
            setError("");
          } else {
            setError(err instanceof Error ? err.message : "Failed to load accounts");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    getMailConfig()
      .then((data) => {
        if (!cancelled) {
          setMailModel(data.mail_model);
          setAvailableModels(data.available_models);
        }
      })
      .catch((err) => {
        if (!cancelled && !(err instanceof ApiError && err.status === 401)) {
          setMailModelError(err instanceof Error ? err.message : "Failed to load mail model");
        }
      });
    if (isAdmin()) {
      getSources()
        .then((data) => {
          if (!cancelled) setNewsSources(data.sources);
        })
        .catch((err) => {
          if (!cancelled) {
            setNewsSourcesError(err instanceof Error ? err.message : "Failed to load news sources");
          }
        })
        .finally(() => {
          if (!cancelled) setNewsSourcesLoading(false);
        });
    } else {
      setNewsSourcesLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setAddError("");
    setAdding(true);
    try {
      const account = await addImapAccount(newName, newServer, newUser, newPass);
      setAccounts((prev) => [...prev, account]);
      setShowAdd(false);
      setNewName("");
      setNewServer("");
      setNewUser("");
      setNewPass("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add account");
    } finally {
      setAdding(false);
    }
  }

  function handleApiKeySave(event: React.FormEvent) {
    event.preventDefault();
    saveApiKey(apiKey);
    setApiKeyNotice(apiKey.trim() ? "API key saved." : "API key cleared.");
  }

  async function handleMailModelSave(event: React.FormEvent) {
    event.preventDefault();
    setSavingMailModel(true);
    setMailModelError("");
    setMailModelNotice("");
    try {
      const response = await updateMailConfig(mailModel);
      setMailModel(response.mail_model);
      setAvailableModels(response.available_models);
      setMailModelNotice(`Mail model saved: ${response.mail_model}`);
    } catch (err) {
      setMailModelError(err instanceof Error ? err.message : "Failed to save mail model");
    } finally {
      setSavingMailModel(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteError("");
    try {
      await deleteImapAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleAddNewsSource(event: FormEvent) {
    event.preventDefault();
    const trimmedLabel = newsLabel.trim();
    const trimmedUrl = newsFeedUrl.trim();
    if (!trimmedLabel || !trimmedUrl) return;

    setAddingSource(true);
    setNewsSourcesError("");
    try {
      const source = await createSource(trimmedLabel, newsTopic, trimmedUrl);
      setNewsSources((current) => [...current, source]);
      setNewsLabel("");
      setNewsFeedUrl("");
    } catch (err) {
      setNewsSourcesError(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setAddingSource(false);
    }
  }

  async function handleToggleNewsSource(id: string) {
    const source = newsSources.find((s) => s.id === id);
    if (!source) return;
    setNewsSourcesError("");
    try {
      const updated = await apiUpdateSource(id, !source.enabled);
      setNewsSources((current) =>
        current.map((s) => (s.id === id ? updated : s)),
      );
    } catch (err) {
      setNewsSourcesError(err instanceof Error ? err.message : "Failed to update source");
    }
  }

  async function handleDeleteNewsSource(id: string) {
    setNewsSourcesError("");
    try {
      await apiDeleteSource(id);
      setNewsSources((current) => current.filter((s) => s.id !== id));
      setConfirmDeleteSourceId(null);
    } catch (err) {
      setNewsSourcesError(err instanceof Error ? err.message : "Failed to delete source");
    }
  }

  async function handleSeedDefaults() {
    setSeeding(true);
    setNewsSourcesError("");
    try {
      const result = await seedDefaults();
      if (result.added.length > 0) {
        setNewsSources((current) => [...current, ...result.added]);
      }
    } catch (err) {
      setNewsSourcesError(err instanceof Error ? err.message : "Failed to load defaults");
    } finally {
      setSeeding(false);
    }
  }

  const filteredModels = availableModels.filter((model) =>
    model.toLowerCase().includes(mailModel.toLowerCase())
  );

  return (
    <section className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your email settings.</p>
      </div>

      {authError && (
        <div className="settings-auth-error">
          <p>Session expired — please <a href="/login">log in</a> again.</p>
        </div>
      )}

      <form className="settings-api-key-form" onSubmit={handleApiKeySave}>
        <label htmlFor="myagent-api-key">MyAgent API Key</label>
        <div className="settings-api-key-row">
          <input
            id="myagent-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              setApiKeyNotice("");
            }}
            placeholder="MYDEVTEAM_API_KEY"
          />
          <button type="submit">save key</button>
        </div>
        {apiKeyNotice ? <p className="settings-notice">{apiKeyNotice}</p> : null}
      </form>

      <form className="settings-api-key-form" onSubmit={handleMailModelSave}>
        <label htmlFor="mail-model">Mail Model</label>
        <div className="settings-mail-model-picker">
          <div className="settings-api-key-row">
            <input
              id="mail-model"
              type="text"
              role="combobox"
              aria-expanded={showMailModelOptions}
              aria-controls="mail-model-options"
              aria-autocomplete="list"
              value={mailModel}
              onFocus={() => setShowMailModelOptions(true)}
              onChange={(event) => {
                setMailModel(event.target.value);
                setShowMailModelOptions(true);
                setMailModelNotice("");
                setMailModelError("");
              }}
              placeholder="Search or type a model name"
            />
            <button type="button" onClick={() => setShowMailModelOptions((open) => !open)}>
              models
            </button>
            <button type="submit" disabled={savingMailModel}>
              {savingMailModel ? "saving..." : "save model"}
            </button>
          </div>
          {showMailModelOptions ? (
            <div className="settings-model-options" id="mail-model-options" role="listbox">
              {filteredModels.length > 0 ? (
                filteredModels.map((model) => (
                  <button
                    key={model}
                    type="button"
                    role="option"
                    className={`settings-model-option${model === mailModel ? " active" : ""}`}
                    onClick={() => {
                      setMailModel(model);
                      setShowMailModelOptions(false);
                      setMailModelNotice("");
                      setMailModelError("");
                    }}
                  >
                    {model}
                  </button>
                ))
              ) : (
                <p className="settings-empty">No matching models.</p>
              )}
            </div>
          ) : null}
        </div>
        {mailModelNotice ? <p className="settings-notice">{mailModelNotice}</p> : null}
        {mailModelError ? <p className="settings-error">{mailModelError}</p> : null}
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="settings-error">{error}</p>
      ) : (
        <>
          {deleteError && <p className="settings-error">{deleteError}</p>}

          {accounts.length > 0 ? (
            <div className="settings-accounts">
              {accounts.map((acc) => (
                <div key={acc.id} className="settings-account-card">
                  <div className="settings-account-info">
                    <div className="settings-account-name">{acc.name}</div>
                    <div className="settings-account-meta">
                      <span>{acc.server}</span>
                      <span>{acc.username}</span>
                    </div>
                  </div>
                  <div className="settings-account-actions">
                    {confirmDeleteId === acc.id ? (
                      <span className="settings-confirm-delete">
                        Delete?
                        <button type="button" onClick={() => void handleDelete(acc.id)} className="delete-btn">Yes</button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="cancel-btn">No</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(acc.id)} className="delete-btn">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="settings-empty">No IMAP accounts configured.</p>
          )}

          {showAdd ? (
            <div className="settings-add-form">
              <h2>Add IMAP Account</h2>
              <form onSubmit={handleAdd}>
                <label>
                  Account Name
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Gmail personal" />
                </label>
                <label>
                  IMAP Server
                  <input type="text" value={newServer} onChange={(e) => setNewServer(e.target.value)} required placeholder="imap.gmail.com" />
                </label>
                <label>
                  Username
                  <input type="text" value={newUser} onChange={(e) => setNewUser(e.target.value)} required placeholder="you@gmail.com" />
                </label>
                <label>
                  Password (app password)
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required placeholder="••••••••" />
                </label>
                {addError && <p className="settings-error">{addError}</p>}
                <div className="settings-add-actions">
                  <button type="submit" disabled={adding}>
                    {adding ? "Adding..." : "Add Account"}
                  </button>
                  <button type="button" onClick={() => { setShowAdd(false); setAddError(""); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAdd(true)} className="add-account-btn">
              + Add IMAP Account
            </button>
          )}
        </>
      )}

      {isAdmin() && <div className="settings-news-sources">
        <h2>News Sources</h2>
        <p>Manage RSS feeds used by the News page.</p>

        {newsSourcesError ? <p className="settings-error">{newsSourcesError}</p> : null}

        <form className="news-source-form-grid" onSubmit={handleAddNewsSource}>
          <label>
            <span>Source name</span>
            <input
              type="text"
              value={newsLabel}
              onChange={(e) => setNewsLabel(e.target.value)}
              placeholder="Reuters"
            />
          </label>
          <label>
            <span>Topic</span>
            <select value={newsTopic} onChange={(e) => setNewsTopic(e.target.value as NewsTopic)}>
              {TOPICS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="news-source-form-url">
            <span>Feed URL</span>
            <input
              type="url"
              value={newsFeedUrl}
              onChange={(e) => setNewsFeedUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
            />
          </label>
          <button type="submit" disabled={!newsLabel.trim() || !newsFeedUrl.trim() || addingSource}>
            {addingSource ? "Adding..." : "Add source"}
          </button>
        </form>

        {newsSourcesLoading ? (
          <p>Loading sources...</p>
        ) : newsSources.length > 0 ? (
          <ul className="news-source-config-list">
            {newsSources.map((s) => (
              <li key={s.id} className="news-source-config-item">
                <label className="news-source-config-toggle">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={() => void handleToggleNewsSource(s.id)}
                  />
                  <span>{s.label}</span>
                </label>
                <span>{s.topic}</span>
                <a href={s.feed_url} target="_blank" rel="noreferrer">{s.feed_url}</a>
                {confirmDeleteSourceId === s.id ? (
                  <span className="settings-confirm-delete">
                    Delete?
                    <button type="button" onClick={() => void handleDeleteNewsSource(s.id)} className="delete-btn">Yes</button>
                    <button type="button" onClick={() => setConfirmDeleteSourceId(null)} className="cancel-btn">No</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDeleteSourceId(s.id)} className="delete-btn">
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="settings-empty">No news sources configured.</p>
        )}

        <button
          type="button"
          onClick={() => void handleSeedDefaults()}
          disabled={seeding}
          className="settings-reset-btn"
        >
          {seeding ? "Loading..." : "Load defaults"}
        </button>
      </div>}
    </section>
  );
}
