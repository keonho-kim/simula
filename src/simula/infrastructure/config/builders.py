"""목적:
- 원시 설정 값을 typed settings로 조립한다.

설명:
- env 스타일 문자열 맵을 `AppSettings`로 조립하고,
  세부 파싱은 전용 helper 모듈로 위임한다.

사용한 설계 패턴:
- thin assembler 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.loader
- simula.infrastructure.config.model_builders
- simula.infrastructure.config.scalar_parsers
"""

from __future__ import annotations

from pathlib import Path
from typing import cast
from simula.infrastructure.config.model_builders import build_model_config
from simula.infrastructure.config.models import (
    AppSettings,
    DatabaseProvider,
    ModelRouterConfig,
    PostgreSQLConfig,
    PostgreSQLTableConfig,
    RuntimeConfig,
    StorageConfig,
)
from simula.infrastructure.config.scalar_parsers import env_bool, env_int, env_str
from simula.infrastructure.config.scalar_parsers import env_optional_int


def build_settings_from_values(values: dict[str, str]) -> AppSettings:
    """원시 문자열 값을 최종 `AppSettings`로 조립한다."""

    if not _has_role_specific_values(values, "FIXER"):
        raise ValueError("llm.fixer 설정이 필요합니다.")

    planner_model = build_model_config(
        values,
        role="PLANNER",
        default_provider="openai",
        default_model="gpt-4.1-mini",
    )
    coordinator_model = (
        planner_model.model_copy(deep=True)
        if not _has_role_specific_values(values, "COORDINATOR")
        else build_model_config(
            values,
            role="COORDINATOR",
            default_provider=planner_model.provider,
            default_model=planner_model.model,
        )
    )
    return AppSettings(
        log_level=env_str(values, "SIM_LOG_LEVEL", "INFO").upper(),
        runtime=RuntimeConfig(
            max_steps=env_int(values, "SIM_MAX_STEPS", 16),
            max_actor_calls_per_step=env_int(
                values,
                "SIM_MAX_ACTOR_CALLS_PER_STEP",
                6,
            ),
            max_focus_slices_per_step=env_int(
                values,
                "SIM_MAX_FOCUS_SLICES_PER_STEP",
                3,
            ),
            max_recipients_per_message=env_int(
                values,
                "SIM_MAX_RECIPIENTS_PER_MESSAGE",
                2,
            ),
            enable_checkpointing=env_bool(
                values,
                "SIM_ENABLE_CHECKPOINTING",
                False,
            ),
            rng_seed=env_optional_int(values, "SIM_RNG_SEED"),
        ),
        storage=StorageConfig(
            provider=cast(
                DatabaseProvider,
                env_str(values, "SIM_DB_PROVIDER", "sqlite"),
            ),
            output_dir=env_str(values, "SIM_OUTPUT_DIR", "./output"),
            sqlite_dir=env_str(values, "SIM_SQLITE_DIR", "./data/db"),
            sqlite_path=resolve_sqlite_path(values),
            postgresql=PostgreSQLConfig(
                host=env_str(values, "SIM_POSTGRES_HOST", "127.0.0.1"),
                port=env_int(values, "SIM_POSTGRES_PORT", 5432),
                user=env_str(values, "SIM_POSTGRES_USER", "postgres"),
                password=env_str(values, "SIM_POSTGRES_PASSWORD", "1234"),
                database=env_str(values, "SIM_POSTGRES_DATABASE", "simula"),
                schema_name=env_str(values, "SIM_POSTGRES_SCHEMA", "simula"),
                tables=PostgreSQLTableConfig(
                    runs=env_str(values, "SIM_POSTGRES_RUNS_TABLE", "runs"),
                    actors=env_str(values, "SIM_POSTGRES_ACTORS_TABLE", "actors"),
                    activities=env_str(
                        values,
                        "SIM_POSTGRES_ACTIVITIES_TABLE",
                        "activities",
                    ),
                    observer_reports=env_str(
                        values,
                        "SIM_POSTGRES_OBSERVER_REPORTS_TABLE",
                        "observer_reports",
                    ),
                    final_reports=env_str(
                        values,
                        "SIM_POSTGRES_FINAL_REPORTS_TABLE",
                        "final_reports",
                    ),
                ),
            ),
        ),
        models=ModelRouterConfig(
            planner=planner_model,
            generator=build_model_config(
                values,
                role="GENERATOR",
                default_provider="openai",
                default_model="gpt-4.1-mini",
            ),
            coordinator=coordinator_model,
            actor=build_model_config(
                values,
                role="ACTOR",
                default_provider="ollama",
                default_model="qwen3:8b",
            ),
            observer=build_model_config(
                values,
                role="OBSERVER",
                default_provider="openai",
                default_model="gpt-4.1-mini",
            ),
            fixer=build_model_config(
                values,
                role="FIXER",
                default_provider="openai",
                default_model="gpt-4.1-mini",
            ),
        ),
    )


def resolve_sqlite_path(values: dict[str, str]) -> str:
    """sqlite 파일 경로를 결정한다."""

    explicit_sqlite_path = values.get("SIM_SQLITE_PATH")
    if explicit_sqlite_path:
        return explicit_sqlite_path

    sqlite_dir = env_str(values, "SIM_SQLITE_DIR", "./data/db")
    return str(Path(sqlite_dir) / "runtime.sqlite")


def _has_role_specific_values(values: dict[str, str], role: str) -> bool:
    """특정 role 전용 설정 키가 하나라도 있는지 확인한다."""

    prefix = f"SIM_{role}_"
    return any(key.startswith(prefix) for key in values)
