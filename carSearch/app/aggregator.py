import asyncio
import time

import httpx

from .adapters.base import Adapter
from .config import Settings
from .models import Listing, SearchFilters, SearchResponse, SiteResult


def _dedup(listings: list[Listing]) -> list[Listing]:
    """Drop obvious duplicates while preserving order.

    Two listings collide if they share a URL, or the same title+price+year
    (the same car cross-posted to multiple sites).
    """
    seen_urls: set[str] = set()
    seen_keys: set[tuple[str, int | None, int | None]] = set()
    out: list[Listing] = []
    for listing in listings:
        url_key = listing.url.strip().lower()
        content_key = (listing.title.strip().lower(), listing.price, listing.year)
        if url_key and url_key in seen_urls:
            continue
        if content_key in seen_keys:
            continue
        seen_urls.add(url_key)
        seen_keys.add(content_key)
        out.append(listing)
    return out


def _sort(listings: list[Listing], sort: str) -> list[Listing]:
    # None values always sort last regardless of direction.
    def key_price(l: Listing) -> tuple[int, int]:
        return (0, l.price) if l.price is not None else (1, 0)

    def key_year(l: Listing) -> tuple[int, int]:
        return (0, l.year) if l.year is not None else (1, 0)

    def key_mileage(l: Listing) -> tuple[int, int]:
        return (0, l.mileage) if l.mileage is not None else (1, 0)

    if sort == "price_asc":
        return sorted(listings, key=key_price)
    if sort == "price_desc":
        return sorted(listings, key=lambda l: (key_price(l)[0], -key_price(l)[1]))
    if sort == "year_desc":
        return sorted(listings, key=lambda l: (key_year(l)[0], -key_year(l)[1]))
    if sort == "year_asc":
        return sorted(listings, key=key_year)
    if sort == "mileage_asc":
        return sorted(listings, key=key_mileage)
    # "relevance": keep source order (grouped by adapter).
    return listings


def _select_adapters(
    filters: SearchFilters, registry: dict[str, Adapter]
) -> list[Adapter]:
    if filters.sites:
        return [registry[sid] for sid in filters.sites if sid in registry]
    return list(registry.values())


async def _run_one(
    adapter: Adapter,
    filters: SearchFilters,
    client: httpx.AsyncClient,
    settings: Settings,
    sem: asyncio.Semaphore,
) -> tuple[SiteResult, list[Listing]]:
    async with sem:
        if not adapter.available(settings):
            return SiteResult(site=adapter.id, label=adapter.label, error="not configured"), []
        try:
            listings = await asyncio.wait_for(
                adapter.search(filters, client, settings),
                timeout=settings.per_site_timeout,
            )
        except asyncio.TimeoutError:
            return SiteResult(site=adapter.id, label=adapter.label, error="timeout"), []
        except Exception as exc:  # noqa: BLE001 — surface as a per-site error
            return SiteResult(site=adapter.id, label=adapter.label, error=str(exc)[:200]), []
        return (
            SiteResult(site=adapter.id, label=adapter.label, count=len(listings)),
            listings,
        )


async def search(
    filters: SearchFilters,
    client: httpx.AsyncClient,
    settings: Settings,
    registry: dict[str, Adapter],
) -> SearchResponse:
    """Fan the query out to every selected site concurrently and merge results."""
    started = time.monotonic()
    adapters = _select_adapters(filters, registry)
    sem = asyncio.Semaphore(max(1, settings.max_concurrency))

    outcomes = await asyncio.gather(
        *(_run_one(a, filters, client, settings, sem) for a in adapters)
    )

    site_results = [outcome[0] for outcome in outcomes]
    merged: list[Listing] = []
    for _, listings in outcomes:
        merged.extend(listings)

    merged = _dedup(merged)
    merged = _sort(merged, filters.sort)
    merged = merged[: filters.limit]

    took_ms = int((time.monotonic() - started) * 1000)
    return SearchResponse(listings=merged, sites=site_results, took_ms=took_ms)
