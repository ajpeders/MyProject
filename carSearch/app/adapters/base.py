from abc import ABC, abstractmethod

import httpx

from ..config import Settings
from ..models import Listing, SearchFilters


class Adapter(ABC):
    """A single car-listing source.

    Subclass this and register it in ``build_registry`` to add a new site.
    Implementations should be resilient: raise on hard failures (the aggregator
    turns exceptions into a per-site error) and never block forever (the
    aggregator enforces a per-site timeout, but be a good citizen anyway).
    """

    id: str
    label: str
    region: str
    #: Optional human note surfaced on GET /sites (e.g. "needs API key").
    note: str | None = None

    def available(self, settings: Settings) -> bool:
        """Whether this adapter is configured enough to run."""
        return True

    @abstractmethod
    async def search(
        self,
        filters: SearchFilters,
        client: httpx.AsyncClient,
        settings: Settings,
    ) -> list[Listing]:
        """Return listings matching ``filters``. May be empty."""
        raise NotImplementedError


def build_registry(settings: Settings) -> dict[str, Adapter]:
    """Instantiate every known adapter, keyed by id.

    Import adapters lazily so this module stays import-cycle free.
    """
    from .craigslist import CraigslistAdapter
    from .demo import DemoAdapter
    from .ebay import EbayAdapter

    adapters: list[Adapter] = [
        DemoAdapter(),
        EbayAdapter(),
        CraigslistAdapter(),
    ]
    return {adapter.id: adapter for adapter in adapters}
