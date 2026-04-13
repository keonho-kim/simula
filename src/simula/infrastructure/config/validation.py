"""목적:
- 최종 설정 객체의 유효성을 검증한다.

설명:
- provider별 필수 인증 정보와 저장소 계약을 명시적으로 확인한다.

사용한 설계 패턴:
- validation service 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.loader
"""

from __future__ import annotations

from simula.infrastructure.config.provider_defaults import is_openai_gpt5_model
from simula.infrastructure.config.models import AppSettings


def validate_settings(settings: AppSettings) -> None:
    """최종 설정 계약을 검증한다."""

    if (
        settings.storage.provider == "sqlite"
        and not settings.storage.sqlite_path.strip()
    ):
        raise ValueError("sqlite 저장 경로가 비어 있습니다.")

    if settings.storage.provider == "postgresql":
        postgres = settings.storage.postgresql
        if not postgres.database.strip():
            raise ValueError("postgresql database 이름이 비어 있습니다.")
        if not postgres.db_schema.strip():
            raise ValueError("postgresql schema 이름이 비어 있습니다.")

    role_configs = (
        ("planner", settings.models.planner),
        ("generator", settings.models.generator),
        ("coordinator", settings.models.coordinator),
        ("actor", settings.models.actor),
        ("observer", settings.models.observer),
        ("fixer", settings.models.fixer),
    )
    for role_name, config in role_configs:
        if not config.model.strip():
            raise ValueError(f"{role_name} 모델 이름이 비어 있습니다.")

        if config.provider in {"openai", "anthropic"} and not config.api_key:
            raise ValueError(
                f"{role_name} provider `{config.provider}` 는 API key가 필요합니다."
            )

        if config.provider in {"ollama", "vllm"} and not config.base_url:
            raise ValueError(
                f"{role_name} provider `{config.provider}` 는 base_url이 필요합니다."
            )

        if config.provider == "google":
            has_gemini_api = bool(config.google.api_key)
            has_any_vertex_input = bool(
                config.google.project_id
                or config.google.location
                or config.google.credentials_path
            )
            has_vertex = bool(config.google.project_id and config.google.location)
            if has_any_vertex_input and not has_vertex:
                raise ValueError(
                    f"{role_name} provider `google` 의 Vertex AI 경로는 project_id와 location이 함께 필요합니다."
                )
            if not has_gemini_api and not has_vertex:
                raise ValueError(
                    f"{role_name} provider `google` 는 Gemini API key 또는 Vertex project_id/location이 필요합니다."
                )

        if config.provider == "bedrock" and not config.bedrock.region_name:
            raise ValueError(
                f"{role_name} provider `bedrock` 는 region_name이 필요합니다."
            )

        if config.openai.reasoning_effort is not None:
            if config.provider != "openai":
                raise ValueError(
                    f"{role_name} provider `{config.provider}` 는 reasoning_effort를 지원하지 않습니다."
                )
            if not is_openai_gpt5_model(config.model):
                raise ValueError(
                    f"{role_name} model `{config.model}` 은 reasoning_effort 대상이 아닙니다."
                )

        if config.openai.verbosity is not None:
            if config.provider != "openai":
                raise ValueError(
                    f"{role_name} provider `{config.provider}` 는 verbosity를 지원하지 않습니다."
                )
            if not is_openai_gpt5_model(config.model):
                raise ValueError(
                    f"{role_name} model `{config.model}` 은 verbosity 대상이 아닙니다."
                )

        if config.reasoning is not None and config.provider != "ollama":
            raise ValueError(
                f"{role_name} provider `{config.provider}` 는 ollama reasoning 설정을 지원하지 않습니다."
            )

        if config.anthropic.effort is not None and config.provider != "anthropic":
            raise ValueError(
                f"{role_name} provider `{config.provider}` 는 anthropic effort 설정을 지원하지 않습니다."
            )

        if config.provider != "google" and (
            config.google.thinking_budget is not None
            or config.google.thinking_level is not None
            or config.google.project_id is not None
            or config.google.location is not None
            or config.google.credentials_path is not None
        ):
            raise ValueError(
                f"{role_name} provider `{config.provider}` 는 google 설정을 지원하지 않습니다."
            )

        if config.provider != "bedrock" and (
            config.bedrock.region_name is not None
            or config.bedrock.credentials_profile_name is not None
            or config.bedrock.endpoint_url is not None
        ):
            raise ValueError(
                f"{role_name} provider `{config.provider}` 는 bedrock 설정을 지원하지 않습니다."
            )
