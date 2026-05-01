import { useCallback, useEffect, useMemo, useState } from "react";
import { TOPICS, type NewsTopic } from "./sources";
import {
  getSources,
  getArticles,
  refreshFeeds,
  type NewsSource,
  type NewsArticle,
} from "../../api/news";

export default function NewsPage() {
  const [topic, setTopic] = useState<NewsTopic>("All");
  const [source, setSource] = useState("All sources");
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [srcData, artData] = await Promise.all([
        getSources(),
        getArticles(topic === "All" ? undefined : topic),
      ]);
      setSources(srcData.sources);
      setArticles(artData.articles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load news");
    } finally {
      setLoading(false);
    }
  }, [topic]);

  useEffect(() => {
    setLoading(true);
    void loadData();
  }, [loadData]);

  const sourceOptions = useMemo(() => {
    const activeForTopic = sources
      .filter((s) => s.enabled && (topic === "All" || s.topic === topic))
      .map((s) => s.label);
    return ["All sources", ...Array.from(new Set(activeForTopic))];
  }, [sources, topic]);

  const visibleArticles = useMemo(
    () =>
      articles.filter(
        (a) => source === "All sources" || a.source_label === source,
      ),
    [articles, source],
  );

  useEffect(() => {
    if (!sourceOptions.includes(source)) {
      setSource("All sources");
    }
  }, [source, sourceOptions]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      await refreshFeeds();
      const artData = await getArticles(topic === "All" ? undefined : topic);
      setArticles(artData.articles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh feeds");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="news-page">
      <header className="news-header">
        <h1>News</h1>
        <p>Browse stories by topic and source. Manage sources in Settings.</p>
      </header>

      <div className="news-toolbar">
        <div className="news-tabs" role="tablist" aria-label="News topics">
          {TOPICS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={topic === item}
              className={topic === item ? "news-tab is-active" : "news-tab"}
              onClick={() => setTopic(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="news-filter">
          <span>Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            {sourceOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="news-refresh-btn"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="news-error">{error}</p> : null}

      {loading ? (
        <p className="news-loading">Loading...</p>
      ) : visibleArticles.length > 0 ? (
        <ul className="news-list" aria-label="News stories">
          {visibleArticles.map((item) => (
            <li key={item.id} className="news-list-item">
              <div className="news-list-meta">
                <a href={item.url} target="_blank" rel="noreferrer">
                  <strong>{item.title}</strong>
                </a>
                <span>{item.source_label}</span>
              </div>
              {item.summary ? <p>{item.summary}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="news-empty">No stories match this topic and source yet.</p>
      )}
    </section>
  );
}
