import base64
import time

import httpx

from ..config import Settings
from ..models import Listing, SearchFilters
from .base import Adapter

OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token"
BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
# eBay Motors > Cars & Trucks
CARS_CATEGORY_ID = "6001"


class EbayAdapter(Adapter):
    """eBay Motors via the Browse API.

    Requires an eBay developer app (client id + secret). Uses the client-
    credentials OAuth flow and caches the application token until it expires.
    """

    id = "ebay_motors"
    label = "eBay Motors"
    region = "US"
    note = "Needs CARSEARCH_EBAY_CLIENT_ID / _SECRET."

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expiry: float = 0.0

    def available(self, settings: Settings) -> bool:
        return bool(settings.ebay_client_id and settings.ebay_client_secret)

    async def _get_token(self, client: httpx.AsyncClient, settings: Settings) -> str:
        now = time.monotonic()
        if self._token and now < self._token_expiry:
            return self._token

        creds = f"{settings.ebay_client_id}:{settings.ebay_client_secret}"
        basic = base64.b64encode(creds.encode()).decode()
        resp = await client.post(
            OAUTH_URL,
            headers={
                "Authorization": f"Basic {basic}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "client_credentials",
                "scope": "https://api.ebay.com/oauth/api_scope",
            },
        )
        resp.raise_for_status()
        payload = resp.json()
        self._token = payload["access_token"]
        # Refresh a minute early to avoid edge-of-expiry failures.
        self._token_expiry = now + float(payload.get("expires_in", 7200)) - 60
        return self._token

    async def search(
        self,
        filters: SearchFilters,
        client: httpx.AsyncClient,
        settings: Settings,
    ) -> list[Listing]:
        token = await self._get_token(client, settings)
        query = filters.query_text() or "car"

        params: dict[str, str] = {
            "q": query,
            "category_ids": CARS_CATEGORY_ID,
            "limit": str(min(filters.limit, 50)),
        }
        api_filters: list[str] = []
        if filters.min_price is not None or filters.max_price is not None:
            lo = filters.min_price if filters.min_price is not None else ""
            hi = filters.max_price if filters.max_price is not None else ""
            api_filters.append(f"price:[{lo}..{hi}]")
            api_filters.append("priceCurrency:USD")
        if api_filters:
            params["filter"] = ",".join(api_filters)

        resp = await client.get(
            BROWSE_URL,
            params=params,
            headers={
                "Authorization": f"Bearer {token}",
                "X-EBAY-C-MARKETPLACE-ID": settings.ebay_marketplace,
            },
        )
        resp.raise_for_status()
        data = resp.json()

        listings: list[Listing] = []
        for item in data.get("itemSummaries", []) or []:
            price = None
            price_obj = item.get("price") or {}
            if price_obj.get("value") is not None:
                try:
                    price = int(float(price_obj["value"]))
                except (TypeError, ValueError):
                    price = None

            location = None
            loc = item.get("itemLocation") or {}
            city, state = loc.get("city"), loc.get("stateOrProvince")
            if city or state:
                location = ", ".join(p for p in (city, state) if p)

            listings.append(
                Listing(
                    id=str(item.get("itemId", "")),
                    site=self.id,
                    site_label=self.label,
                    title=item.get("title", "eBay listing"),
                    price=price,
                    year=None,
                    make=filters.make,
                    model=filters.model,
                    mileage=None,
                    location=location,
                    url=item.get("itemWebUrl", ""),
                    image_url=(item.get("image") or {}).get("imageUrl"),
                    dealer=(item.get("seller") or {}).get("username"),
                )
            )
        return listings
