import { apiFetch } from "./client";

export interface SearchProviderOption {
  id: string;
  label: string;
}

export interface SearchConfigResponse {
  search_provider: string;
  available_providers: SearchProviderOption[];
}

export function getSearchConfig(): Promise<SearchConfigResponse> {
  return apiFetch<SearchConfigResponse>("/api/config/search", { method: "GET" });
}

export function updateSearchConfig(searchProvider: string): Promise<SearchConfigResponse> {
  return apiFetch<SearchConfigResponse>("/api/config/search", {
    method: "PUT",
    body: JSON.stringify({ search_provider: searchProvider }),
  });
}
