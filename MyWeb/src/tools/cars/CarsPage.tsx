import { type FormEvent, useMemo, useState } from "react";
import {
  searchCars,
  type CarListing,
  type CarSearchFilters,
  type CarSiteResult,
  type CarSort,
} from "../../api/cars";
import {
  CAR_REGIONS,
  CAR_SOURCES,
  loadEnabledSiteIds,
  saveEnabledSiteIds,
} from "./sources";

const SORT_OPTIONS: { value: CarSort; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "year_desc", label: "Year: newest" },
  { value: "year_asc", label: "Year: oldest" },
  { value: "mileage_asc", label: "Mileage: lowest" },
];

function toNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatPrice(price: number | null): string {
  return price == null ? "Price N/A" : `$${price.toLocaleString()}`;
}

function formatMileage(mileage: number | null): string | null {
  return mileage == null ? null : `${mileage.toLocaleString()} mi`;
}

function listingSubtitle(listing: CarListing): string {
  const parts = [
    listing.year != null ? String(listing.year) : null,
    listing.make,
    listing.model,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" ");
}

export default function CarsPage() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [keywords, setKeywords] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [maxMileage, setMaxMileage] = useState("");
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("");
  const [sort, setSort] = useState<CarSort>("relevance");

  const [selectedSites, setSelectedSites] = useState<Set<string>>(
    () => new Set(loadEnabledSiteIds()),
  );
  const [showSites, setShowSites] = useState(false);

  const [listings, setListings] = useState<CarListing[]>([]);
  const [siteResults, setSiteResults] = useState<CarSiteResult[]>([]);
  const [viewSite, setViewSite] = useState("All sites");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");

  function persistSites(next: Set<string>) {
    setSelectedSites(next);
    saveEnabledSiteIds([...next]);
  }

  function toggleSite(id: string) {
    const next = new Set(selectedSites);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    persistSites(next);
  }

  function selectAllSites() {
    persistSites(new Set(CAR_SOURCES.map((source) => source.id)));
  }

  function clearAllSites() {
    persistSites(new Set());
  }

  const viewOptions = useMemo(() => {
    const withResults = siteResults
      .filter((result) => result.count > 0)
      .map((result) => result.label);
    return ["All sites", ...withResults];
  }, [siteResults]);

  const visibleListings = useMemo(
    () =>
      viewSite === "All sites"
        ? listings
        : listings.filter((listing) => listing.site_label === viewSite),
    [listings, viewSite],
  );

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const sites = [...selectedSites];
    if (sites.length === 0) {
      setError("Select at least one site to search.");
      return;
    }

    const filters: CarSearchFilters = {
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      keywords: keywords.trim() || undefined,
      min_price: toNumber(minPrice),
      max_price: toNumber(maxPrice),
      min_year: toNumber(minYear),
      max_year: toNumber(maxYear),
      max_mileage: toNumber(maxMileage),
      zip: zip.trim() || undefined,
      radius: toNumber(radius),
      sort,
    };

    setLoading(true);
    setError("");
    setViewSite("All sites");

    try {
      const data = await searchCars(filters, sites);
      setListings(data.listings || []);
      setSiteResults(data.sites || []);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Car search failed");
      setListings([]);
      setSiteResults([]);
    } finally {
      setLoading(false);
    }
  }

  const failedSites = siteResults.filter((result) => result.error);

  return (
    <section className="cars-page">
      <header className="cars-header">
        <h1>Car Search</h1>
        <p>Search car listings across many marketplaces at once.</p>
      </header>

      <form className="cars-form" onSubmit={handleSearch}>
        <div className="cars-form-grid">
          <label>
            <span>Make</span>
            <input
              type="text"
              value={make}
              onChange={(event) => setMake(event.target.value)}
              placeholder="e.g. Toyota"
            />
          </label>
          <label>
            <span>Model</span>
            <input
              type="text"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="e.g. Camry"
            />
          </label>
          <label>
            <span>Keywords</span>
            <input
              type="text"
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              placeholder="e.g. AWD, leather"
            />
          </label>
          <label>
            <span>Min price</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="$"
            />
          </label>
          <label>
            <span>Max price</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="$"
            />
          </label>
          <label>
            <span>Min year</span>
            <input
              type="number"
              inputMode="numeric"
              value={minYear}
              onChange={(event) => setMinYear(event.target.value)}
              placeholder="e.g. 2015"
            />
          </label>
          <label>
            <span>Max year</span>
            <input
              type="number"
              inputMode="numeric"
              value={maxYear}
              onChange={(event) => setMaxYear(event.target.value)}
              placeholder="e.g. 2024"
            />
          </label>
          <label>
            <span>Max mileage</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={maxMileage}
              onChange={(event) => setMaxMileage(event.target.value)}
              placeholder="miles"
            />
          </label>
          <label>
            <span>ZIP / postal code</span>
            <input
              type="text"
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              placeholder="e.g. 94103"
            />
          </label>
          <label>
            <span>Radius (mi)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              placeholder="e.g. 100"
            />
          </label>
          <label>
            <span>Sort by</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as CarSort)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="cars-form-actions">
          <button
            type="button"
            className="cars-sites-toggle"
            aria-expanded={showSites}
            onClick={() => setShowSites((prev) => !prev)}
          >
            {showSites ? "Hide sites" : "Choose sites"} ({selectedSites.size}/{CAR_SOURCES.length})
          </button>
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search cars"}
          </button>
        </div>
      </form>

      {showSites ? (
        <section className="cars-sites" aria-label="Sites to search">
          <div className="cars-sites-bar">
            <h2>Sites to search</h2>
            <div className="cars-sites-bulk">
              <button type="button" onClick={selectAllSites}>Select all</button>
              <button type="button" onClick={clearAllSites}>Clear all</button>
            </div>
          </div>
          {CAR_REGIONS.map((region) => {
            const regionSources = CAR_SOURCES.filter((source) => source.region === region);
            if (regionSources.length === 0) return null;
            return (
              <div key={region} className="cars-sites-region">
                <h3>{region}</h3>
                <div className="cars-sites-grid">
                  {regionSources.map((source) => (
                    <label key={source.id} className="cars-site-option">
                      <input
                        type="checkbox"
                        checked={selectedSites.has(source.id)}
                        onChange={() => toggleSite(source.id)}
                      />
                      <span>{source.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {error ? <p className="cars-error">{error}</p> : null}

      {hasSearched && !loading ? (
        <section className="cars-results">
          <div className="cars-results-bar">
            <h2>
              {listings.length} {listings.length === 1 ? "listing" : "listings"}
              {siteResults.length > 0
                ? ` from ${siteResults.filter((s) => s.count > 0).length} of ${siteResults.length} sites`
                : ""}
            </h2>
            {viewOptions.length > 1 ? (
              <label className="cars-view-filter">
                <span>Site</span>
                <select value={viewSite} onChange={(event) => setViewSite(event.target.value)}>
                  {viewOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {failedSites.length > 0 ? (
            <p className="cars-warning">
              Couldn&apos;t reach: {failedSites.map((s) => s.label).join(", ")}
            </p>
          ) : null}

          {visibleListings.length > 0 ? (
            <ul className="cars-list" aria-label="Car listings">
              {visibleListings.map((listing) => {
                const subtitle = listingSubtitle(listing);
                const mileage = formatMileage(listing.mileage);
                return (
                  <li key={`${listing.site}-${listing.id}`} className="cars-list-item">
                    {listing.image_url ? (
                      <img
                        className="cars-list-thumb"
                        src={listing.image_url}
                        alt=""
                        loading="lazy"
                      />
                    ) : null}
                    <div className="cars-list-body">
                      <div className="cars-list-top">
                        <a href={listing.url} target="_blank" rel="noopener noreferrer">
                          <strong>{listing.title}</strong>
                        </a>
                        <span className="cars-list-price">{formatPrice(listing.price)}</span>
                      </div>
                      {subtitle ? <p className="cars-list-subtitle">{subtitle}</p> : null}
                      <p className="cars-list-meta">
                        <span className="cars-site-badge">{listing.site_label}</span>
                        {mileage ? <span>{mileage}</span> : null}
                        {listing.location ? <span>{listing.location}</span> : null}
                        {listing.dealer ? <span>{listing.dealer}</span> : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="cars-empty">No listings matched your search. Try widening the filters or adding more sites.</p>
          )}
        </section>
      ) : null}
    </section>
  );
}
