import { apiFetch } from "./client";

export type CarSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "year_desc"
  | "year_asc"
  | "mileage_asc";

export interface CarSearchFilters {
  make?: string;
  model?: string;
  keywords?: string;
  min_price?: number;
  max_price?: number;
  min_year?: number;
  max_year?: number;
  max_mileage?: number;
  zip?: string;
  radius?: number;
  sort?: CarSort;
}

export interface CarListing {
  id: string;
  site: string;
  site_label: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  location: string | null;
  url: string;
  image_url: string | null;
  dealer: string | null;
}

/** Per-site outcome so the UI can report coverage and partial failures. */
export interface CarSiteResult {
  site: string;
  label: string;
  count: number;
  error?: string | null;
}

export interface CarSearchResponse {
  listings: CarListing[];
  sites: CarSiteResult[];
}

/**
 * Aggregate car listings across the selected marketplaces. The backend fans the
 * query out to each site it can reach and returns a unified, de-duplicated list
 * plus a per-site breakdown.
 */
export function searchCars(
  filters: CarSearchFilters,
  sites: string[],
): Promise<CarSearchResponse> {
  return apiFetch<CarSearchResponse>("/api/cars/search", {
    method: "POST",
    body: JSON.stringify({ ...filters, sites }),
  });
}
