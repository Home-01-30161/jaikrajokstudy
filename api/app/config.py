"""Application settings loaded from environment / .env."""

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    log_level: str = "INFO"
    host: str = "0.0.0.0"
    port: int = 8000

    # Hackathon deploy: proxy strips /api, so root_path keeps docs working.
    root_path: str = ""
    team: str = "team07"

    # Secrets. On the hackathon server, CI writes only APP_*-prefixed CI/CD
    # variables into .env, so each secret accepts both the plain name (local
    # dev) and the APP_-prefixed name (deployed).
    aiforthai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("AIFORTHAI_API_KEY", "APP_AIFORTHAI_API_KEY"),
    )
    aiforthai_base_url: str = Field(
        default="https://api.aiforthai.in.th",
        validation_alias=AliasChoices("AIFORTHAI_BASE_URL", "APP_AIFORTHAI_BASE_URL"),
    )
    pathumma_endpoint: str = Field(
        default="",
        validation_alias=AliasChoices("PATHUMMA_ENDPOINT", "APP_PATHUMMA_ENDPOINT"),
    )
    pathumma_model: str = Field(
        default="pathumma-llm-text-1.0.0",
        validation_alias=AliasChoices("PATHUMMA_MODEL", "APP_PATHUMMA_MODEL"),
    )

    line_channel_access_token: str = Field(
        default="",
        validation_alias=AliasChoices(
            "LINE_CHANNEL_ACCESS_TOKEN", "APP_LINE_CHANNEL_ACCESS_TOKEN"
        ),
    )
    line_channel_secret: str = Field(
        default="",
        validation_alias=AliasChoices(
            "LINE_CHANNEL_SECRET", "APP_LINE_CHANNEL_SECRET"
        ),
    )

    @property
    def pathumma_url(self) -> str:
        if self.pathumma_endpoint:
            return self.pathumma_endpoint
        return f"{self.aiforthai_base_url.rstrip('/')}/pathumma-llm"


@lru_cache
def get_settings() -> Settings:
    return Settings()
