export type NewsTopic = "All" | "Tech" | "Music" | "World" | "US News" | "Hip Hop" | "Gaming";

export interface NewsSource {
  id: string;
  label: string;
  topic: NewsTopic;
  feedUrl: string;
  enabled: boolean;
}

export const TOPICS: NewsTopic[] = ["All", "Tech", "Music", "World", "US News", "Hip Hop", "Gaming"];

const NEWS_SOURCE_STORAGE_KEY = "myagent.news.sources";


export function loadSources(): NewsSource[] {
  const raw = localStorage.getItem(NEWS_SOURCE_STORAGE_KEY);
  if (!raw) return DEFAULT_SOURCES;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_SOURCES;

    const normalized = parsed.filter((item): item is NewsSource => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<NewsSource>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.label === "string" &&
        typeof candidate.feedUrl === "string" &&
        typeof candidate.enabled === "boolean" &&
        TOPICS.includes(candidate.topic as NewsTopic)
      );
    });

    return normalized.length > 0 ? normalized : DEFAULT_SOURCES;
  } catch {
    return DEFAULT_SOURCES;
  }
}

export function saveSources(sources: NewsSource[]): void {
  localStorage.setItem(NEWS_SOURCE_STORAGE_KEY, JSON.stringify(sources));
}
