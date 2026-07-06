import asyncio

import pytest

from app.aggregator import _dedup, _sort, search
from app.config import Settings
from app.models import Listing, SearchFilters
from app.adapters.base import Adapter


def _listing(**kw) -> Listing:
    base = dict(
        id="x",
        site="s",
        site_label="S",
        title="car",
        url="https://example.invalid/x",
    )
    base.update(kw)
    return Listing(**base)


def test_dedup_by_url():
    # Distinct titles so only the shared-URL collision (a, b) is exercised.
    a = _listing(id="1", url="https://a/1", title="Car A")
    b = _listing(id="2", url="https://a/1", title="Car B")  # same url as a
    c = _listing(id="3", url="https://a/3", title="Car C")
    assert [l.id for l in _dedup([a, b, c])] == ["1", "3"]


def test_dedup_by_content():
    a = _listing(id="1", url="https://a/1", title="2018 Toyota", price=100, year=2018)
    b = _listing(id="2", url="https://b/2", title="2018 Toyota", price=100, year=2018)
    assert [l.id for l in _dedup([a, b])] == ["1"]


def test_sort_price_asc_nulls_last():
    items = [_listing(id="a", price=None), _listing(id="b", price=200), _listing(id="c", price=100)]
    assert [l.id for l in _sort(items, "price_asc")] == ["c", "b", "a"]


def test_sort_year_desc():
    items = [_listing(id="a", year=2010), _listing(id="b", year=2022), _listing(id="c", year=None)]
    assert [l.id for l in _sort(items, "year_desc")] == ["b", "a", "c"]


class _StubAdapter(Adapter):
    def __init__(self, id_, listings=None, fail=False, hang=False, ok=True):
        self.id = id_
        self.label = id_.title()
        self.region = "US"
        self._listings = listings or []
        self._fail = fail
        self._hang = hang
        self._ok = ok

    def available(self, settings):
        return self._ok

    async def search(self, filters, client, settings):
        if self._hang:
            await asyncio.sleep(5)
        if self._fail:
            raise RuntimeError("boom")
        return self._listings


@pytest.mark.asyncio
async def test_search_merges_and_reports_per_site():
    settings = Settings(per_site_timeout=0.2, max_concurrency=8)
    registry = {
        "good": _StubAdapter("good", [_listing(id="g", site="good", url="https://g/1")]),
        "bad": _StubAdapter("bad", fail=True),
        "slow": _StubAdapter("slow", hang=True),
        "off": _StubAdapter("off", ok=False),
    }
    resp = await search(SearchFilters(), client=None, settings=settings, registry=registry)

    assert len(resp.listings) == 1
    by_site = {s.site: s for s in resp.sites}
    assert by_site["good"].count == 1 and by_site["good"].error is None
    assert by_site["bad"].error == "boom"
    assert by_site["slow"].error == "timeout"
    assert by_site["off"].error == "not configured"


@pytest.mark.asyncio
async def test_search_respects_site_selection():
    settings = Settings()
    registry = {
        "a": _StubAdapter("a", [_listing(id="a", site="a", url="https://a/1")]),
        "b": _StubAdapter("b", [_listing(id="b", site="b", url="https://b/1")]),
    }
    resp = await search(
        SearchFilters(sites=["a"]), client=None, settings=settings, registry=registry
    )
    assert {s.site for s in resp.sites} == {"a"}
    assert [l.id for l in resp.listings] == ["a"]
