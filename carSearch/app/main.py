from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .adapters.base import build_registry
from .aggregator import search as run_search
from .config import get_settings
from .models import SearchFilters, SearchResponse, SiteInfo


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.registry = build_registry(settings)
    app.state.client = httpx.AsyncClient(
        timeout=settings.per_site_timeout,
        headers={"User-Agent": settings.user_agent},
        follow_redirects=True,
    )
    try:
        yield
    finally:
        await app.state.client.aclose()


app = FastAPI(
    title="carSearch",
    version=__version__,
    summary="Aggregate car listings across many marketplaces.",
    lifespan=lifespan,
)

_cors = get_settings().cors_origin_list()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "carSearch", "version": __version__}


@app.get("/sites", response_model=list[SiteInfo])
async def sites() -> list[SiteInfo]:
    settings = app.state.settings
    registry = app.state.registry
    return [
        SiteInfo(
            id=adapter.id,
            label=adapter.label,
            region=adapter.region,
            available=adapter.available(settings),
            note=adapter.note,
        )
        for adapter in registry.values()
    ]


@app.post("/search", response_model=SearchResponse)
async def search(filters: SearchFilters) -> SearchResponse:
    return await run_search(
        filters,
        app.state.client,
        app.state.settings,
        app.state.registry,
    )
