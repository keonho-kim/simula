"""목적:
- env 파일, 환경 변수, CLI override를 병합해 최종 설정을 만든다.

설명:
- env 파일, 환경 변수, CLI override를 단일 설정 계약으로 병합한다.

사용한 설계 패턴:
- facade loader 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.sources
- simula.infrastructure.config.builders
- simula.infrastructure.config.validation
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from simula.infrastructure.config.builders import build_settings_from_values
from simula.infrastructure.config.models import AppSettings
from simula.infrastructure.config.sources import (
    load_env_file_values,
    load_environment_values,
    load_toml_file,
    resolve_env_file,
)
from simula.infrastructure.config.validation import validate_settings

_REMOVED_RUNTIME_TIME_KEYS = (
    "SIM_TIME_UNIT",
    "SIM_TIME_STEP_SIZE",
)


@dataclass(frozen=True, slots=True)
class LoadedSettingsBundle:
    """설정값 묶음이다."""

    settings: AppSettings


def load_settings(
    env_file: str | Path | None = None,
    *,
    cli_overrides: dict[str, str] | None = None,
) -> AppSettings:
    """최종 설정을 로드한다."""

    return load_settings_bundle(
        env_file,
        cli_overrides=cli_overrides,
    ).settings


def load_settings_bundle(
    env_file: str | Path | None = None,
    *,
    cli_overrides: dict[str, str] | None = None,
) -> LoadedSettingsBundle:
    """최종 설정 묶음을 로드한다."""

    resolved_env_file = resolve_env_file(env_file)
    parsed = load_toml_file(resolved_env_file)
    file_values = load_env_file_values(parsed, required=resolved_env_file is not None)
    merged = dict(file_values)
    merged.update(load_environment_values())

    if cli_overrides:
        merged.update(
            {key: value for key, value in cli_overrides.items() if value is not None}
        )

    _validate_removed_runtime_time_keys(merged)
    _validate_raw_storage_shape(merged)
    settings = build_settings_from_values(merged)
    validate_settings(settings)
    return LoadedSettingsBundle(settings=settings)


def _validate_removed_runtime_time_keys(values: dict[str, str]) -> None:
    """제거된 고정 시간축 입력이 들어오면 명시적으로 실패시킨다."""

    for key in _REMOVED_RUNTIME_TIME_KEYS:
        value = values.get(key)
        if value is not None and str(value).strip():
            removed_name = key.removeprefix("SIM_").lower()
            raise ValueError(
                f"`{removed_name}` 설정은 더 이상 지원하지 않습니다. 동적 시간축에서는 max_steps만 설정할 수 있습니다."
            )


def _validate_raw_storage_shape(values: dict[str, str]) -> None:
    """raw 설정 기준으로 db provider와 하위 세부 설정 존재 여부를 확인한다."""

    provider = values.get("SIM_DB_PROVIDER", "sqlite").strip().lower()
    if provider == "sqlite":
        if not (
            values.get("__DB_SQLITE_DEFINED__") == "true"
            or "SIM_SQLITE_DIR" in values
            or "SIM_SQLITE_PATH" in values
        ):
            raise ValueError(
                "db.provider=sqlite 이면 [db.sqlite] 또는 동등한 환경 변수 설정이 필요합니다."
            )
        return

    if provider == "postgresql":
        postgres_keys = {
            "SIM_POSTGRES_HOST",
            "SIM_POSTGRES_PORT",
            "SIM_POSTGRES_USER",
            "SIM_POSTGRES_PASSWORD",
            "SIM_POSTGRES_DATABASE",
            "SIM_POSTGRES_SCHEMA",
        }
        if not (
            values.get("__DB_POSTGRESQL_DEFINED__") == "true"
            or postgres_keys.intersection(values)
        ):
            raise ValueError(
                "db.provider=postgresql 이면 [db.postgresql] 또는 동등한 환경 변수 설정이 필요합니다."
            )
