import { apiFetch } from "./client";

export interface SearchResult {
  title?: string;
  url: string;
  snippet?: string;
  source?: string;
  [key: string]: unknown;
}

export interface SearchResponse {
  answer: string;
  results: SearchResult[];
}

export interface BrowseResponse {
  url?: string;
  title?: string;
  summary?: string;
  content?: string;
  answer?: string;
  [key: string]: unknown;
}

export function searchWeb(query: string, skipAnswer = false): Promise<SearchResponse> {
  return apiFetch<SearchResponse>("/api/search", {
    method: "POST",
    body: JSON.stringify({ query, skip_answer: skipAnswer }),
  });
}

export function browseSearchResult(url: string): Promise<BrowseResponse> {
  return apiFetch<BrowseResponse>(`/api/search/browse?url=${encodeURIComponent(url)}`, {
    method: "GET",
  });
}
