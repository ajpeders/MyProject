import httpx
import pytest
import respx

from app.adapters.craigslist import CraigslistAdapter
from app.adapters.demo import DemoAdapter
from app.adapters.ebay import EbayAdapter
from app.config import Settings
from app.models import SearchFilters


@pytest.mark.asyncio
async def test_demo_filters_by_make_and_price():
    adapter = DemoAdapter()
    settings = Settings(enable_demo=True)
    filters = SearchFilters(make="Toyota", max_price=20000)
    results = await adapter.search(filters, client=None, settings=settings)
    assert results, "expected at least one demo listing"
    assert all(r.make == "Toyota" for r in results)
    assert all(r.price is None or r.price <= 20000 for r in results)


def test_demo_availability_toggle():
    adapter = DemoAdapter()
    assert adapter.available(Settings(enable_demo=True)) is True
    assert adapter.available(Settings(enable_demo=False)) is False


def test_ebay_unavailable_without_credentials():
    assert EbayAdapter().available(Settings()) is False
    assert EbayAdapter().available(
        Settings(ebay_client_id="id", ebay_client_secret="secret")
    ) is True


@respx.mock
@pytest.mark.asyncio
async def test_ebay_search_maps_results():
    respx.post("https://api.ebay.com/identity/v1/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "tok", "expires_in": 7200})
    )
    respx.get("https://api.ebay.com/buy/browse/v1/item_summary/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "itemSummaries": [
                    {
                        "itemId": "v1|123|0",
                        "title": "2019 Honda Civic EX",
                        "price": {"value": "17995.00", "currency": "USD"},
                        "itemWebUrl": "https://www.ebay.com/itm/123",
                        "image": {"imageUrl": "https://img/1.jpg"},
                        "itemLocation": {"city": "San Jose", "stateOrProvince": "CA"},
                        "seller": {"username": "topseller"},
                    }
                ]
            },
        )
    )
    adapter = EbayAdapter()
    settings = Settings(ebay_client_id="id", ebay_client_secret="secret")
    async with httpx.AsyncClient() as client:
        results = await adapter.search(
            SearchFilters(make="Honda", model="Civic"), client, settings
        )
    assert len(results) == 1
    r = results[0]
    assert r.price == 17995
    assert r.location == "San Jose, CA"
    assert r.url == "https://www.ebay.com/itm/123"
    assert r.dealer == "topseller"


@respx.mock
@pytest.mark.asyncio
async def test_craigslist_parses_rss():
    rss = """<?xml version='1.0'?>
    <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>
      <item>
        <title>2016 Toyota Camry SE $12,500</title>
        <link>https://sfbay.craigslist.org/sfc/cto/d/camry/7777.html</link>
      </item>
      <item>
        <title>Nice truck</title>
        <link>https://sfbay.craigslist.org/sfc/cto/d/truck/8888.html</link>
      </item>
    </rdf:RDF>"""
    respx.get("https://sfbay.craigslist.org/search/cta").mock(
        return_value=httpx.Response(200, text=rss)
    )
    adapter = CraigslistAdapter()
    settings = Settings(craigslist_region="sfbay")
    async with httpx.AsyncClient() as client:
        results = await adapter.search(SearchFilters(keywords="camry"), client, settings)
    assert len(results) == 2
    first = results[0]
    assert first.price == 12500
    assert first.year == 2016
    assert first.url.endswith("7777.html")
