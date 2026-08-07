"""Application settings loaded from environment / .env."""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file (api/app/config.py → ../../.env = project root)
# so the env file is found regardless of the working directory uvicorn starts in.
_ENV_FILE = str(Path(__file__).resolve().parent.parent.parent / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    log_level: str = "INFO"
    host: str = "0.0.0.0"
    port: int = 8000

    # PostgreSQL connection (per hackathon guide section 11).
    # On the server: postgresql+psycopg://app:team07pass@db:5432/app
    # Locally: falls back to SQLite via store.py when left empty.
    database_url: str = Field(
        default="",
        validation_alias=AliasChoices("DATABASE_URL", "APP_DATABASE_URL"),
    )

    # Hackathon deploy: proxy strips /api, so root_path keeps docs working.
    root_path: str = ""
    team: str = "team07"
    cors_origins: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("CORS_ORIGINS", "APP_CORS_ORIGINS"),
    )
    session_secret: str = Field(
        default="",
        validation_alias=AliasChoices("SESSION_SECRET", "APP_SESSION_SECRET"),
    )

    # TLS verification for outbound calls. Defaults to ON. Only set this false
    # for local shells with a broken CA bundle (e.g. MSYS2 Python); never in
    # the deployed container, where certs verify fine.
    insecure_tls: bool = Field(
        default=False,
        validation_alias=AliasChoices("INSECURE_TLS", "APP_INSECURE_TLS"),
    )

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

    # Pathumma TokenMind gateway (OpenAI-compatible). Serves the LLM and ASR.
    # Separate credential from AIFORTHAI_API_KEY, which still serves
    # sentiment / face / OCR / TTS because this gateway does not offer them.
    tokenmind_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("TOKENMIND_API_KEY", "APP_TOKENMIND_API_KEY"),
    )
    tokenmind_base_url: str = Field(
        default="https://tokenmind.pathumma.in.th/v1",
        validation_alias=AliasChoices("TOKENMIND_BASE_URL", "APP_TOKENMIND_BASE_URL"),
    )
    tokenmind_llm_model: str = Field(
        default="thaillm-8b",
        validation_alias=AliasChoices("TOKENMIND_LLM_MODEL", "APP_TOKENMIND_LLM_MODEL"),
    )
    tokenmind_asr_model: str = Field(
        default="ptm-asr-1",
        validation_alias=AliasChoices("TOKENMIND_ASR_MODEL", "APP_TOKENMIND_ASR_MODEL"),
    )
    tokenmind_tts_model: str = Field(
        default="ptm-tts-1",
        validation_alias=AliasChoices("TOKENMIND_TTS_MODEL", "APP_TOKENMIND_TTS_MODEL"),
    )
    # Off by default: ptm-tts-1 returns HTTP 500 for every request, including
    # ones with the required `input` field omitted, so the fault is upstream of
    # request validation. Trying it first only adds latency, so TTS goes
    # straight to Vaja9. Flip this to 1 once the gateway serves audio.
    tokenmind_tts_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "TOKENMIND_TTS_ENABLED", "APP_TOKENMIND_TTS_ENABLED"
        ),
    )
    # Left empty by default: the gateway exposes no /v1/voices route, so no
    # valid voice id is known. Set it once the organizers publish one.
    tokenmind_tts_voice: str = Field(
        default="",
        validation_alias=AliasChoices("TOKENMIND_TTS_VOICE", "APP_TOKENMIND_TTS_VOICE"),
    )

    # Typhoon OCR (SCB 10X) - replaces AI for Thai OCR to avoid "roi" errors
    typhoon_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("TYPHOON_API_KEY", "APP_TYPHOON_API_KEY"),
    )
    typhoon_base_url: str = Field(
        default="https://api.opentyphoon.ai/v1/ocr",
        validation_alias=AliasChoices("TYPHOON_BASE_URL", "APP_TYPHOON_BASE_URL"),
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
