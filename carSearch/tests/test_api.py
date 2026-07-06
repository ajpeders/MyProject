import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # Trigger lifespan so app.state is populated.
        async with app.router.lifespan_context(app):
            yield c


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "carSearch"


@pytest.mark.asyncio
async def test_sites_lists_adapters(client):
    resp = await client.get("/sites")
    assert resp.status_code == 200
    ids = {s["id"] for s in resp.json()}
    assert {"demo", "ebay_motors", "craigslist"} <= ids


@pytest.mark.asyncio
async def test_search_returns_demo_results(client):
    resp = await client.post("/search", json={"make": "Toyota", "sites": ["demo"]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["sites"][0]["site"] == "demo"
    assert len(body["listings"]) >= 1
    assert all(l["make"] == "Toyota" for l in body["listings"])
    assert "took_ms" in body
