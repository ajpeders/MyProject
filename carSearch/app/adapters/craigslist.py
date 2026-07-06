import re

import httpx
from bs4 import BeautifulSoup

from ..config import Settings
from ..models import Listing, SearchFilters
from .base import Adapter

_PRICE_RE = re.compile(r"\$[\d,]+")
_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


class CraigslistAdapter(Adapter):
    """Craigslist cars+trucks via a region's RSS feed.

    Craigslist has no public API. The RSS feed is the most stable machine-
    readable surface, but it is best-effort: it covers a single region
    (CARSEARCH_CRAIGSLIST_REGION) and exposes limited structured data, so most
    fields beyond title/price/url are parsed heuristically or left null.
    """

    id = "craigslist"
    label = "Craigslist"
    region = "US"
    note = "Best-effort RSS for one region (CARSEARCH_CRAIGSLIST_REGION)."

    def available(self, settings: Settings) -> bool:
        return bool(settings.craigslist_region)

    async def search(
        self,
        filters: SearchFilters,
        client: httpx.AsyncClient,
        settings: Settings,
    ) -> list[Listing]:
        region = settings.craigslist_region
        url = f"https://{region}.craigslist.org/search/cta"
        params: dict[str, str] = {"format": "rss"}
        query = filters.query_text()
        if query:
            params["query"] = query
        if filters.min_price is not None:
            params["min_price"] = str(filters.min_price)
        if filters.max_price is not None:
            params["max_price"] = str(filters.max_price)
        if filters.max_year is not None:
            params["max_auto_year"] = str(filters.max_year)
        if filters.min_year is not None:
            params["min_auto_year"] = str(filters.min_year)
        if filters.max_mileage is not None:
            params["max_auto_miles"] = str(filters.max_mileage)

        resp = await client.get(url, params=params)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "xml")
        listings: list[Listing] = []
        for item in soup.find_all("item"):
            title = (item.title.text if item.title else "").strip()
            link = (item.link.text if item.link else "").strip()
            if not title or not link:
                continue

            price = None
            price_match = _PRICE_RE.search(title)
            if price_match:
                try:
                    price = int(price_match.group().lstrip("$").replace(",", ""))
                except ValueError:
                    price = None

            year = None
            year_match = _YEAR_RE.search(title)
            if year_match:
                year = int(year_match.group())

            listings.append(
                Listing(
                    id=link.rstrip("/").split("/")[-1] or link,
                    site=self.id,
                    site_label=self.label,
                    title=title,
                    price=price,
                    year=year,
                    make=filters.make,
                    model=filters.model,
                    mileage=None,
                    location=region,
                    url=link,
                    image_url=None,
                    dealer=None,
                )
            )
        return listings
