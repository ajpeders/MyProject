from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment / .env (prefix CARSEARCH_)."""

    model_config = SettingsConfigDict(
        env_prefix="CARSEARCH_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server behaviour
    per_site_timeout: float = 12.0
    max_concurrency: int = 8
    user_agent: str = "carSearch/0.1 (+homelab)"
    cors_origins: str = "*"

    # Demo adapter (synthetic data so the service is useful with no credentials)
    enable_demo: bool = True

    # eBay Browse API
    ebay_client_id: str = ""
    ebay_client_secret: str = ""
    ebay_marketplace: str = "EBAY_US"

    # Craigslist (RSS, best-effort)
    craigslist_region: str = "sfbay"

    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*" or not raw:
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
