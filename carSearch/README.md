# carSearch

A small, standalone service that searches car listings across many
marketplaces at once and returns a single merged result set. It fans a query
out to per-site **adapters** concurrently, normalizes and de-duplicates the
results, and reports what each site returned (including failures).

This service is fully self-contained — it has **no dependency on any other
project** and is meant to run on its own in a homelab (Docker or bare uvicorn).

## Quick start (Docker)

```bash
cp .env.example .env      # optional; the demo adapter works with no config
docker compose up --build
```

Then:

```bash
curl localhost:8080/health
curl localhost:8080/sites
curl -X POST localhost:8080/search \
  -H 'content-type: application/json' \
  -d '{"make":"Toyota","max_price":25000,"sort":"price_asc"}'
```

Interactive API docs are at `http://localhost:8080/docs`.

## Quick start (local Python)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8080
pytest
```

## API

| Method | Path      | Description                                             |
| ------ | --------- | ------------------------------------------------------- |
| GET    | `/health` | Liveness probe.                                         |
| GET    | `/sites`  | List adapters and whether each is configured/available. |
| POST   | `/search` | Aggregate listings across sites.                        |

`POST /search` body (all fields optional):

```jsonc
{
  "make": "Toyota",
  "model": "Camry",
  "keywords": "AWD leather",
  "min_price": 0, "max_price": 25000,
  "min_year": 2015, "max_year": 2024,
  "max_mileage": 80000,
  "zip": "94103", "radius": 100,
  "sort": "price_asc",          // relevance|price_asc|price_desc|year_desc|year_asc|mileage_asc
  "sites": ["demo", "ebay_motors"], // omit to query every available site
  "limit": 50
}
```

Response: `{ listings: Listing[], sites: SiteResult[], took_ms: number }`.
Each `SiteResult` carries a per-site `count` and an optional `error`
(`"not configured"`, `"timeout"`, or the failure message) so partial results
are always explainable.

## Adapters

| id            | site          | status                                            |
| ------------- | ------------- | ------------------------------------------------- |
| `demo`        | Demo Listings | Synthetic data; on by default so it works with no config. |
| `ebay_motors` | eBay Motors   | Real Browse API. Needs `CARSEARCH_EBAY_CLIENT_ID` / `_SECRET`. |
| `craigslist`  | Craigslist    | Best-effort RSS for one region (`CARSEARCH_CRAIGSLIST_REGION`). |

An adapter that isn't configured is simply reported as `"not configured"` and
skipped — the service still returns whatever the other sites found.

### Adding a site

1. Create `app/adapters/<site>.py` with a class subclassing `Adapter`
   (see `app/adapters/base.py`). Implement `search()` and, if it needs
   credentials, `available()`.
2. Register it in `build_registry()` in `app/adapters/base.py`.
3. Add a test in `tests/test_adapters.py` (use `respx` to mock HTTP).

> **Note on scraping:** several large marketplaces have no public API and/or
> forbid scraping in their terms of service. Add adapters for those only where
> you have permission or an API key. The framework isolates each adapter and
> caps it with a per-site timeout, so a slow or blocked site never breaks a
> search.

## Configuration

All settings are environment variables prefixed `CARSEARCH_` (see
`.env.example`). Key ones: `PER_SITE_TIMEOUT`, `MAX_CONCURRENCY`,
`CORS_ORIGINS`, `ENABLE_DEMO`, `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`,
`CRAIGSLIST_REGION`.

## Extracting this into its own repository

This directory is self-contained. To make it a standalone repo:

```bash
# from a copy of this carSearch/ directory
git init
git add .
git commit -m "Initial commit: carSearch service"
git remote add origin <your-new-repo-url>
git push -u origin main
```

Nothing here imports from the parent project, so no code changes are needed
after extraction.
