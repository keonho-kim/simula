"""목적:
- 애플리케이션 전역 설정과 모델 라우팅 계약을 정의한다.

설명:
- `env.toml`, 실제 환경 변수, CLI override가 합쳐진 뒤 사용될 typed settings를 관리한다.

사용한 설계 패턴:
- Pydantic 설정 계약 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.loader
- simula.infrastructure.llm.router
- simula.entrypoints.bootstrap
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Provider = Literal["openai", "anthropic", "google", "ollama", "vllm", "bedrock"]
DatabaseProvider = Literal["sqlite", "postgresql"]
ReasoningEffort = Literal["none", "low", "medium", "high", "xhigh"]
Verbosity = Literal["low", "medium", "high"]
OllamaReasoning = bool | Literal["low", "medium", "high"]
AnthropicEffort = Literal["low", "medium", "high", "max"]
GoogleThinkingLevel = Literal["minimal", "low", "medium", "high"]


class OpenAIProviderConfig(BaseModel):
    """OpenAI provider 전용 설정이다."""

    api_key: str | None = None
    base_url: str | None = None
    reasoning_effort: ReasoningEffort | None = None
    verbosity: Verbosity | None = None


class AnthropicProviderConfig(BaseModel):
    """Anthropic provider 전용 설정이다."""

    api_key: str | None = None
    base_url: str | None = None
    effort: AnthropicEffort | None = None


class GoogleProviderConfig(BaseModel):
    """Google provider 전용 설정이다."""

    api_key: str | None = None
    base_url: str | None = None
    project_id: str | None = None
    location: str | None = None
    credentials_path: str | None = None
    thinking_budget: int | None = None
    thinking_level: GoogleThinkingLevel | None = None


class BedrockProviderConfig(BaseModel):
    """Bedrock provider 전용 설정이다."""

    region_name: str | None = None
    credentials_profile_name: str | None = None
    endpoint_url: str | None = None


class OllamaProviderConfig(BaseModel):
    """Ollama provider 전용 설정이다."""

    base_url: str | None = None
    reasoning: OllamaReasoning | None = None


class VllmProviderConfig(BaseModel):
    """vLLM provider 전용 설정이다."""

    api_key: str | None = None
    base_url: str | None = None


class ModelConfig(BaseModel):
    """역할별 LLM 연결 정보와 provider별 옵션을 함께 정의한다."""

    provider: Provider
    model: str
    temperature: float = 0.6
    max_tokens: int = 2400
    timeout_seconds: float = 60.0
    openai: OpenAIProviderConfig = Field(default_factory=OpenAIProviderConfig)
    anthropic: AnthropicProviderConfig = Field(default_factory=AnthropicProviderConfig)
    google: GoogleProviderConfig = Field(default_factory=GoogleProviderConfig)
    bedrock: BedrockProviderConfig = Field(default_factory=BedrockProviderConfig)
    ollama: OllamaProviderConfig = Field(default_factory=OllamaProviderConfig)
    vllm: VllmProviderConfig = Field(default_factory=VllmProviderConfig)

    def active_provider_config(
        self,
    ) -> (
        OpenAIProviderConfig
        | AnthropicProviderConfig
        | GoogleProviderConfig
        | BedrockProviderConfig
        | OllamaProviderConfig
        | VllmProviderConfig
    ):
        """현재 provider에 대응하는 설정 객체를 반환한다."""

        if self.provider == "openai":
            return self.openai
        if self.provider == "anthropic":
            return self.anthropic
        if self.provider == "google":
            return self.google
        if self.provider == "bedrock":
            return self.bedrock
        if self.provider == "ollama":
            return self.ollama
        return self.vllm

    @property
    def api_key(self) -> str | None:
        """현재 provider가 사용할 API key를 반환한다."""

        provider_config = self.active_provider_config()
        return getattr(provider_config, "api_key", None)

    @property
    def base_url(self) -> str | None:
        """현재 provider가 사용할 base URL을 반환한다."""

        provider_config = self.active_provider_config()
        return getattr(provider_config, "base_url", None)

    @property
    def reasoning_effort(self) -> ReasoningEffort | None:
        """OpenAI reasoning effort 설정을 반환한다."""

        return self.openai.reasoning_effort if self.provider == "openai" else None

    @property
    def verbosity(self) -> Verbosity | None:
        """OpenAI verbosity 설정을 반환한다."""

        return self.openai.verbosity if self.provider == "openai" else None

    @property
    def reasoning(self) -> OllamaReasoning | None:
        """Ollama reasoning 설정을 반환한다."""

        return self.ollama.reasoning if self.provider == "ollama" else None


class RuntimeConfig(BaseModel):
    """핵심 루프 실행 한계를 정의한다."""

    max_steps: int = Field(default=16, ge=1)
    max_actor_calls_per_step: int = Field(default=6, ge=1)
    max_focus_slices_per_step: int = Field(default=3, ge=1)
    max_recipients_per_message: int = 2
    enable_checkpointing: bool = False
    rng_seed: int | None = None


class PostgreSQLTableConfig(BaseModel):
    """PostgreSQL 앱 테이블 이름 설정이다."""

    runs: str = "runs"
    actors: str = "actors"
    activities: str = "activities"
    observer_reports: str = "observer_reports"
    final_reports: str = "final_reports"


class PostgreSQLConfig(BaseModel):
    """PostgreSQL 연결 및 스키마 설정이다."""

    model_config = ConfigDict(populate_by_name=True)

    host: str = "127.0.0.1"
    port: int = 5432
    user: str = "postgres"
    password: str = "1234"
    database: str = "simula"
    schema_name: str = Field(default="simula", alias="schema")
    tables: PostgreSQLTableConfig = Field(default_factory=PostgreSQLTableConfig)

    @property
    def schema(self) -> str:
        """호환용 schema 접근자다."""

        return self.schema_name


class StorageConfig(BaseModel):
    """저장소 연결 정보를 정의한다."""

    provider: DatabaseProvider = "sqlite"
    output_dir: str = "./output"
    sqlite_dir: str = "./data/db"
    sqlite_path: str = "./data/db/runtime.sqlite"
    postgresql: PostgreSQLConfig = Field(default_factory=PostgreSQLConfig)


class ModelRouterConfig(BaseModel):
    """역할별 모델 설정 묶음을 정의한다."""

    planner: ModelConfig
    generator: ModelConfig
    coordinator: ModelConfig
    actor: ModelConfig
    observer: ModelConfig


class AppSettings(BaseModel):
    """애플리케이션 전체 설정을 정의한다."""

    log_level: str = "INFO"
    runtime: RuntimeConfig = Field(default_factory=RuntimeConfig)
    storage: StorageConfig = Field(default_factory=StorageConfig)
    models: ModelRouterConfig

    def redacted_dump(self) -> dict[str, object]:
        """저장 가능한 형태로 민감정보를 마스킹한다."""

        data = self.model_dump(mode="json")
        for role in ("planner", "generator", "coordinator", "actor", "observer"):
            role_cfg = data["models"][role]
            for provider_name in ("openai", "anthropic", "google", "vllm"):
                provider_cfg = role_cfg.get(provider_name)
                if isinstance(provider_cfg, dict) and provider_cfg.get("api_key"):
                    provider_cfg["api_key"] = "***"
        return data
