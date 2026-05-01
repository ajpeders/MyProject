import { type FormEvent, useEffect, useState } from "react";
import {
  addMemory,
  deleteMemory,
  listMemories,
  type MemoryItem,
} from "../../api/memory";

function formatCreatedAt(value: number | null | undefined): string {
  if (typeof value !== "number") return "unknown";
  return new Date(value * 1000).toLocaleString();
}

function formatScore(value: number | null | undefined): string {
  if (typeof value !== "number") return "";
  return value.toFixed(3);
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [newMemory, setNewMemory] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadMemories(nextQuery = query) {
    setLoading(true);
    setError("");
    try {
      const data = await listMemories(nextQuery);
      setMemories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listMemories("")
      .then((data) => {
        if (!cancelled) setMemories(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load memories");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = draftQuery.trim();
    setQuery(nextQuery);
    setNotice(nextQuery ? `Showing matches for "${nextQuery}".` : "");
    await loadMemories(nextQuery);
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = newMemory.trim();
    if (!content) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await addMemory(content);
      setNewMemory("");
      setNotice("Memory saved.");
      await loadMemories(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save memory");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(memoryId: string) {
    setDeletingId(memoryId);
    setError("");
    setNotice("");
    try {
      await deleteMemory(memoryId);
      setNotice("Memory deleted.");
      await loadMemories(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memory");
    } finally {
      setDeletingId("");
    }
  }

  async function handleClearSearch() {
    setDraftQuery("");
    setQuery("");
    setNotice("");
    await loadMemories("");
  }

  return (
    <section className="memory-page">
      <div className="memory-header">
        <h1>Memory</h1>
        <p>Store, search, and remove personal memories.</p>
      </div>

      <form className="memory-add-form" onSubmit={handleAdd}>
        <label htmlFor="memory-content">Add Memory</label>
        <textarea
          id="memory-content"
          value={newMemory}
          onChange={(event) => setNewMemory(event.target.value)}
          placeholder="Remember this about me..."
          rows={4}
          disabled={saving}
        />
        <div className="memory-actions">
          <button type="submit" disabled={saving || !newMemory.trim()}>
            {saving ? "Saving..." : "Save Memory"}
          </button>
        </div>
      </form>

      <form className="memory-search-form" onSubmit={handleSearch}>
        <label htmlFor="memory-query">Search Memories</label>
        <div className="memory-search-row">
          <input
            id="memory-query"
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="project preferences, tools, ideas..."
            disabled={loading}
          />
          <button type="submit" disabled={loading}>Search</button>
          <button type="button" onClick={() => void handleClearSearch()} disabled={loading || (!query && !draftQuery)}>
            Clear
          </button>
        </div>
      </form>

      {error ? <p className="memory-error" role="alert">{error}</p> : null}
      {notice ? <p className="memory-notice">{notice}</p> : null}

      <section className="memory-results" aria-label="Memory list">
        <div className="memory-results-header">
          <h2>{query ? "Search Results" : "All Memories"}</h2>
          {loading ? <span>Loading...</span> : <span>{memories.length} item{memories.length === 1 ? "" : "s"}</span>}
        </div>

        {memories.length > 0 ? (
          <ul className="memory-list">
            {memories.map((memory) => (
              <li key={memory.memory_id} className="memory-item">
                <p>{memory.content}</p>
                <div className="memory-meta">
                  <span>{memory.memory_id}</span>
                  <span>{formatCreatedAt(memory.created_at)}</span>
                  {query && formatScore(memory.score) ? <span>score {formatScore(memory.score)}</span> : null}
                </div>
                <div className="memory-actions">
                  <button
                    type="button"
                    onClick={() => void handleDelete(memory.memory_id)}
                    disabled={deletingId === memory.memory_id}
                  >
                    {deletingId === memory.memory_id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="memory-empty">{loading ? "Loading..." : "No memories found."}</p>
        )}
      </section>
    </section>
  );
}
