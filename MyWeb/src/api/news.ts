import { apiFetch } from "./client";

export interface NewsSource {
  id: string;
  user_id: string;
  label: string;
  topic: string;
  feed_url: string;
  enabled: boolean;
  created_at: number;
}

export interface NewsArticle {
  id: string;
  source_id: string;
  source_label: string;
  title: string;
  topic: string;
  url: string;
  published_at: string;
  summary: string | null;
}

export function getSources(): Promise<{ sources: NewsSource[] }> {
  return apiFetch<{ sources: NewsSource[] }>("/api/news/sources", { method: "GET" });
}

export function createSource(
  label: string,
  topic: string,
  feed_url: string,
): Promise<NewsSource> {
  return apiFetch<NewsSource>("/api/news/sources", {
    method: "POST",
    body: JSON.stringify({ label, topic, feed_url }),
  });
}

export function updateSource(
  sourceId: string,
  enabled: boolean,
): Promise<NewsSource> {
  return apiFetch<NewsSource>(`/api/news/sources/${sourceId}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export function deleteSource(sourceId: string): Promise<void> {
  return apiFetch<void>(`/api/news/sources/${sourceId}`, { method: "DELETE" });
}

export function getArticles(
  topic?: string,
  sourceId?: string,
  limit = 50,
  offset = 0,
): Promise<{ articles: NewsArticle[] }> {
  const params = new URLSearchParams();
  if (topic) params.set("topic", topic);
  if (sourceId) params.set("source_id", sourceId);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return apiFetch<{ articles: NewsArticle[] }>(
    `/api/news/articles?${params}`,
    { method: "GET" },
  );
}

export function refreshFeeds(): Promise<{ new_articles: number }> {
  return apiFetch<{ new_articles: number }>("/api/news/refresh", { method: "POST" });
}

export function seedDefaults(): Promise<{ added: NewsSource[]; count: number }> {
  return apiFetch<{ added: NewsSource[]; count: number }>("/api/news/sources/seed", { method: "POST" });
}
