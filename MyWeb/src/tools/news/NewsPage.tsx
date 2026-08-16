import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TOPICS, type NewsTopic } from "./sources";
import {
  getSources,
  getArticles,
  getCuratedFeed,
  rateCurated,
  refreshFeeds,
  type NewsSource,
  type NewsArticle,
  type CuratedArticle,
} from "../../api/news";
import { logSignal } from "../../api/profile";

export default function NewsPage() {
  const [forYou, setForYou] = useState(true);
  const [topic, setTopic] = useState<NewsTopic>("All");
  const [source, setSource] = useState("All sources");
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [curatedArticles, setCuratedArticles] = useState<CuratedArticle[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Which view the loaded articles belong to. `loading` is derived from it, so
  // switching tabs shows the spinner without a setState-in-effect round trip.
  const viewKey = forYou ? "for-you" : `topic:${topic}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== viewKey;

  const loadCurated = useCallback(async () => {
    setError("");
    try {
      const data = await getCuratedFeed();
      setCuratedArticles(data.articles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load curated feed");
    }
  }, []);

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
    }
  }, [topic]);

  useEffect(() => {
    let cancelled = false;
    const key = viewKey;
    const load = forYou ? loadCurated : loadData;
    // Settle even on failure — the error banner replaces the spinner.
    void load().finally(() => {
      if (!cancelled) setLoadedKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [viewKey, forYou, loadCurated, loadData]);

  const sourceOptions = useMemo(() => {
    const activeForTopic = sources
      .filter((s) => s.enabled && (topic === "All" || s.topic === topic))
      .map((s) => s.label);
    return ["All sources", ...Array.from(new Set(activeForTopic))];
  }, [sources, topic]);

  // Derived, not stored: when the topic changes the previously-picked source may
  // no longer be offered, and falling back during render avoids a reset effect
  // (and the extra render pass it would cost).
  const effectiveSource = sourceOptions.includes(source) ? source : "All sources";

  const visibleArticles = useMemo(
    () =>
      articles.filter(
        (a) => effectiveSource === "All sources" || a.source_label === effectiveSource,
      ),
    [articles, effectiveSource],
  );

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      await refreshFeeds();
      if (forYou) {
        const data = await getCuratedFeed();
        setCuratedArticles(data.articles);
      } else {
        const artData = await getArticles(topic === "All" ? undefined : topic);
        setArticles(artData.articles);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh feeds");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRate(curatedId: string, rating: 1 | -1, item: CuratedArticle) {
    try {
      await rateCurated(curatedId, rating);
      void logSignal(rating === 1 ? "thumbs_up" : "thumbs_down", item.topic, item.source_label);
    } catch {
      // silent — rating is best-effort
    }
  }

  function handleSelectForYou() {
    setForYou(true);
  }

  function handleSelectTopic(t: NewsTopic) {
    setForYou(false);
    setTopic(t);
  }

  return (
    <section className="news-page">
      <header className="news-header">
        <h1>News</h1>
        <p>Browse stories by topic and source. <Link to="/settings">Tune your interests</Link></p>
      </header>

      <div className="news-toolbar">
        <div className="news-tabs" role="tablist" aria-label="News topics">
          <button
            type="button"
            role="tab"
            aria-selected={forYou}
            className={forYou ? "news-tab is-active" : "news-tab"}
            onClick={handleSelectForYou}
          >
            For You
          </button>
          {TOPICS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={!forYou && topic === item}
              className={!forYou && topic === item ? "news-tab is-active" : "news-tab"}
              onClick={() => handleSelectTopic(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {!forYou && (
          <label className="news-filter">
            <span>Source</span>
            <select value={effectiveSource} onChange={(event) => setSource(event.target.value)}>
              {sourceOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        )}

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
      ) : forYou ? (
        curatedArticles.length > 0 ? (
          <ul className="news-list" aria-label="Curated stories">
            {curatedArticles.map((item) => (
              <li key={item.curated_id} className="news-list-item">
                <div className="news-list-meta">
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <strong>{item.title}</strong>
                  </a>
                  <span>{item.source_label}</span>
                </div>
                <p>{item.summary}</p>
                <p className="news-curated-reason">{item.reason}</p>
                <div className="news-curated-actions">
                  <button
                    type="button"
                    aria-label="Thumbs up"
                    onClick={() => void handleRate(item.curated_id, 1, item)}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    aria-label="Thumbs down"
                    onClick={() => void handleRate(item.curated_id, -1, item)}
                  >
                    -1
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="news-empty">
          <Link to="/settings">Set up your interests</Link> to get personalized picks.
        </p>
        )
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
