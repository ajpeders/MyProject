from typing import Literal, Optional

from pydantic import BaseModel, Field

CarSort = Literal[
    "relevance",
    "price_asc",
    "price_desc",
    "year_desc",
    "year_asc",
    "mileage_asc",
]


class SearchFilters(BaseModel):
    """Search criteria fanned out to every selected site."""

    make: Optional[str] = None
    model: Optional[str] = None
    keywords: Optional[str] = None
    min_price: Optional[int] = None
    max_price: Optional[int] = None
    min_year: Optional[int] = None
    max_year: Optional[int] = None
    max_mileage: Optional[int] = None
    zip: Optional[str] = None
    radius: Optional[int] = None
    sort: CarSort = "relevance"
    # Which site ids to query. Empty/None means "every available site".
    sites: Optional[list[str]] = None
    limit: int = Field(default=50, ge=1, le=200)

    def query_text(self) -> str:
        """A free-text query built from make/model/keywords."""
        parts = [self.make, self.model, self.keywords]
        return " ".join(p.strip() for p in parts if p and p.strip()).strip()


class Listing(BaseModel):
    id: str
    site: str
    site_label: str
    title: str
    price: Optional[int] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    mileage: Optional[int] = None
    location: Optional[str] = None
    url: str
    image_url: Optional[str] = None
    dealer: Optional[str] = None


class SiteResult(BaseModel):
    site: str
    label: str
    count: int = 0
    error: Optional[str] = None


class SearchResponse(BaseModel):
    listings: list[Listing]
    sites: list[SiteResult]
    took_ms: int


class SiteInfo(BaseModel):
    id: str
    label: str
    region: str
    available: bool
    note: Optional[str] = None
