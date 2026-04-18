"""목적:
- 설정 파일과 환경 변수에서 원시 값을 수집한다.

설명:
- nested TOML 구조를 내부 env-style 맵으로 평탄화하고, 실제 환경 변수도 함께 읽는다.

사용한 설계 패턴:
- source adapter 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.loader
"""

from __future__ import annotations

import json
import os
import tomllib
from pathlib import Path
from typing import Any

SUPPORTED_PREFIXES = (
    "SIM_",
    "OPENAI_",
    "OPENAI_COMPATIBLE_",
    "ANTHROPIC_",
    "GOOGLE_",
    "BEDROCK_",
)

ROLE_NAMES = ("planner", "generator", "coordinator", "actor", "observer", "fixer")
PROVIDER_NAMES = (
    "openai",
    "openai-compatible",
    "anthropic",
    "google",
    "bedrock",
)
_LEGACY_KEY_PREFIXES = SUPPORTED_PREFIXES


def resolve_env_file(
    env_file: str | Path | None,
) -> Path | None:
    """사용할 설정 파일 경로를 결정한다."""

    if env_file is not None:
        path = Path(env_file)
        if not path.exists():
            raise FileNotFoundError(f"env 파일을 찾을 수 없습니다: {path}")
        return path

    default_name = "env.toml"
    default_path = Path(default_name)
    if default_path.exists():
        return default_path

    return None


def load_toml_file(env_file: Path | None) -> dict[str, Any]:
    """TOML 파일을 읽어 파싱한다."""

    if env_file is None:
        return {}

    with env_file.open("rb") as file:
        return tomllib.load(file)


def load_env_file_values(
    parsed: dict[str, Any],
    *,
    required: bool,
) -> dict[str, str]:
    """top-level `env/time/db/fs/llm` 테이블을 내부 원시 문자열 맵으로 변환한다."""

    present_sections = [
        name for name in ("env", "time", "db", "fs", "llm") if name in parsed
    ]
    if not present_sections:
        if required:
            raise ValueError(
                "설정 파일 최상위에는 [env], [time], [db], [fs], [llm] 중 하나 이상이 필요합니다."
            )
        return {}

    values: dict[str, str] = {}
    values.update(_flatten_env_table(parsed.get("env")))
    values.update(_flatten_time_table(parsed.get("time")))
    values.update(_flatten_db_table(parsed.get("db")))
    values.update(_flatten_fs_table(parsed.get("fs")))
    values.update(_flatten_llm_table(parsed.get("llm")))
    return values


def load_environment_values() -> dict[str, str]:
    """지원 prefix를 가진 실제 환경 변수만 읽는다."""

    return {
        key: value
        for key, value in os.environ.items()
        if key.startswith(SUPPORTED_PREFIXES)
    }


def coerce_env_value(value: Any) -> str:
    """TOML 원시 값을 env 스타일 문자열로 변환한다."""

    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    return str(value)


def _flatten_env_table(table: Any) -> dict[str, str]:
    if table is None:
        return {}
    if not isinstance(table, dict):
        raise ValueError("설정 파일의 [env] 값은 테이블이어야 합니다.")

    _reject_legacy_keys(table, table_name="[env]")
    key_map = {
        "log_level": "SIM_LOG_LEVEL",
        "max_recipients_per_message": "SIM_MAX_RECIPIENTS_PER_MESSAGE",
        "max_actor_calls_per_step": "SIM_MAX_ACTOR_CALLS_PER_STEP",
        "max_focus_slices_per_step": "SIM_MAX_FOCUS_SLICES_PER_STEP",
        "enable_checkpointing": "SIM_ENABLE_CHECKPOINTING",
        "rng_seed": "SIM_RNG_SEED",
    }
    return _map_scalar_keys(table, key_map)


def _flatten_time_table(table: Any) -> dict[str, str]:
    if table is None:
        return {}
    if not isinstance(table, dict):
        raise ValueError("설정 파일의 [time] 값은 테이블이어야 합니다.")

    _reject_legacy_keys(table, table_name="[time]")
    unexpected_keys = sorted(set(table) - {"max_rounds"})
    if unexpected_keys:
        raise ValueError("[time]에는 `max_rounds`만 둘 수 있습니다.")
    key_map = {
        "max_rounds": "SIM_MAX_ROUNDS",
    }
    return _map_scalar_keys(table, key_map)


def _flatten_db_table(table: Any) -> dict[str, str]:
    if table is None:
        return {}
    if not isinstance(table, dict):
        raise ValueError("설정 파일의 [db] 값은 테이블이어야 합니다.")

    _reject_legacy_keys(table, table_name="[db]")
    values = _map_scalar_keys(
        table,
        {
            "provider": "SIM_DB_PROVIDER",
        },
    )

    sqlite_table = table.get("sqlite")
    if sqlite_table is not None:
        if not isinstance(sqlite_table, dict):
            raise ValueError("설정 파일의 [db.sqlite] 값은 테이블이어야 합니다.")
        _reject_legacy_keys(sqlite_table, table_name="[db.sqlite]")
        values["__DB_SQLITE_DEFINED__"] = "true"
        values.update(
            _map_scalar_keys(
                sqlite_table,
                {
                    "dir": "SIM_SQLITE_DIR",
                    "path": "SIM_SQLITE_PATH",
                },
            )
        )

    postgres_table = table.get("postgresql")
    if postgres_table is not None:
        if not isinstance(postgres_table, dict):
            raise ValueError("설정 파일의 [db.postgresql] 값은 테이블이어야 합니다.")
        _reject_legacy_keys(postgres_table, table_name="[db.postgresql]")
        values["__DB_POSTGRESQL_DEFINED__"] = "true"
        values.update(
            _map_scalar_keys(
                postgres_table,
                {
                    "host": "SIM_POSTGRES_HOST",
                    "port": "SIM_POSTGRES_PORT",
                    "user": "SIM_POSTGRES_USER",
                    "password": "SIM_POSTGRES_PASSWORD",
                    "database": "SIM_POSTGRES_DATABASE",
                    "schema": "SIM_POSTGRES_SCHEMA",
                    "runs_table": "SIM_POSTGRES_RUNS_TABLE",
                    "actors_table": "SIM_POSTGRES_ACTORS_TABLE",
                    "activities_table": "SIM_POSTGRES_ACTIVITIES_TABLE",
                    "observer_reports_table": "SIM_POSTGRES_OBSERVER_REPORTS_TABLE",
                    "final_reports_table": "SIM_POSTGRES_FINAL_REPORTS_TABLE",
                },
            )
        )

    return values


def _flatten_fs_table(table: Any) -> dict[str, str]:
    if table is None:
        return {}
    if not isinstance(table, dict):
        raise ValueError("설정 파일의 [fs] 값은 테이블이어야 합니다.")

    _reject_legacy_keys(table, table_name="[fs]")
    return _map_scalar_keys(
        table,
        {
            "output_dir": "SIM_OUTPUT_DIR",
        },
    )


def _flatten_llm_table(table: Any) -> dict[str, str]:
    if table is None:
        return {}
    if not isinstance(table, dict):
        raise ValueError("설정 파일의 [llm] 값은 테이블이어야 합니다.")

    for key, value in table.items():
        if isinstance(value, dict):
            continue
        raise ValueError("[llm] 에는 provider 또는 role 하위 테이블만 둘 수 있습니다.")

    values = _flatten_llm_shared_table(table)
    for role in ROLE_NAMES:
        role_table = table.get(role)
        if role_table is None:
            continue
        if not isinstance(role_table, dict):
            raise ValueError(f"설정 파일의 [llm.{role}] 값은 테이블이어야 합니다.")
        values.update(_flatten_llm_role_table(role, role_table))
    return values


def _flatten_llm_shared_table(table: dict[str, Any]) -> dict[str, str]:
    _reject_legacy_keys(table, table_name="[llm]")
    values: dict[str, str] = {}
    provider_tables: dict[str, tuple[str, dict[str, str]]] = {
        "openai": (
            "[llm.openai]",
            {
                "API_KEY": "OPENAI_API_KEY",
                "base_url": "OPENAI_BASE_URL",
                "stream_usage": "OPENAI_STREAM_USAGE",
                "reasoning_effort": "OPENAI_REASONING_EFFORT",
                "verbosity": "OPENAI_VERBOSITY",
            },
        ),
        "openai-compatible": (
            "[llm.openai-compatible]",
            {
                "API_KEY": "OPENAI_COMPATIBLE_API_KEY",
                "base_url": "OPENAI_COMPATIBLE_BASE_URL",
                "stream_usage": "OPENAI_COMPATIBLE_STREAM_USAGE",
            },
        ),
        "anthropic": (
            "[llm.anthropic]",
            {
                "API_KEY": "ANTHROPIC_API_KEY",
                "base_url": "ANTHROPIC_BASE_URL",
                "effort": "ANTHROPIC_EFFORT",
            },
        ),
        "google": (
            "[llm.google]",
            {
                "API_KEY": "GOOGLE_API_KEY",
                "base_url": "GOOGLE_BASE_URL",
                "project_id": "GOOGLE_PROJECT_ID",
                "location": "GOOGLE_LOCATION",
                "credentials_path": "GOOGLE_CREDENTIALS_PATH",
                "thinking_budget": "GOOGLE_THINKING_BUDGET",
                "thinking_level": "GOOGLE_THINKING_LEVEL",
            },
        ),
        "bedrock": (
            "[llm.bedrock]",
            {
                "region_name": "BEDROCK_REGION_NAME",
                "credentials_profile_name": "BEDROCK_CREDENTIALS_PROFILE_NAME",
                "endpoint_url": "BEDROCK_ENDPOINT_URL",
            },
        ),
    }

    for provider_name in PROVIDER_NAMES:
        if provider_name in ROLE_NAMES:
            continue
        provider_table = table.get(provider_name)
        if provider_table is None:
            continue
        if not isinstance(provider_table, dict):
            raise ValueError(
                f"설정 파일의 [llm.{provider_name}] 값은 테이블이어야 합니다."
            )
        table_name, key_map = provider_tables[provider_name]
        _reject_legacy_keys(provider_table, table_name=table_name)
        values.update(_map_scalar_keys(provider_table, key_map))
        if provider_name == "openai-compatible":
            extra_body = _collect_extra_body(
                provider_table,
                reserved_keys={"API_KEY", "base_url", "stream_usage"},
            )
            if extra_body:
                values["OPENAI_COMPATIBLE_EXTRA_BODY"] = coerce_env_value(extra_body)
    return values


def _flatten_llm_role_table(role: str, table: dict[str, Any]) -> dict[str, str]:
    _reject_legacy_keys(table, table_name=f"[llm.{role}]")
    role_prefix = role.upper()
    values = _map_scalar_keys(
        table,
        {
            "provider": f"SIM_{role_prefix}_PROVIDER",
            "model": f"SIM_{role_prefix}_MODEL",
            "temperature": f"SIM_{role_prefix}_TEMPERATURE",
            "max_tokens": f"SIM_{role_prefix}_MAX_TOKENS",
            "timeout_seconds": f"SIM_{role_prefix}_TIMEOUT_SECONDS",
            "API_KEY": f"SIM_{role_prefix}_API_KEY",
            "base_url": f"SIM_{role_prefix}_BASE_URL",
            "stream_usage": f"SIM_{role_prefix}_STREAM_USAGE",
            "reasoning_effort": f"SIM_{role_prefix}_REASONING_EFFORT",
            "verbosity": f"SIM_{role_prefix}_VERBOSITY",
            "effort": f"SIM_{role_prefix}_ANTHROPIC_EFFORT",
            "project_id": f"SIM_{role_prefix}_GOOGLE_PROJECT_ID",
            "location": f"SIM_{role_prefix}_GOOGLE_LOCATION",
            "credentials_path": f"SIM_{role_prefix}_GOOGLE_CREDENTIALS_PATH",
            "thinking_budget": f"SIM_{role_prefix}_GOOGLE_THINKING_BUDGET",
            "thinking_level": f"SIM_{role_prefix}_GOOGLE_THINKING_LEVEL",
            "region_name": f"SIM_{role_prefix}_BEDROCK_REGION_NAME",
            "credentials_profile_name": f"SIM_{role_prefix}_BEDROCK_CREDENTIALS_PROFILE_NAME",
            "endpoint_url": f"SIM_{role_prefix}_BEDROCK_ENDPOINT_URL",
        },
    )

    _reject_role_provider_subtables(role, table)

    extra_body = _collect_extra_body(
        table,
        reserved_keys={
            "provider",
            "model",
            "temperature",
            "max_tokens",
            "timeout_seconds",
            "API_KEY",
            "base_url",
            "stream_usage",
            "reasoning_effort",
            "verbosity",
            "effort",
            "project_id",
            "location",
            "credentials_path",
            "thinking_budget",
            "thinking_level",
            "region_name",
            "credentials_profile_name",
            "endpoint_url",
        },
    )
    if extra_body:
        values[f"SIM_{role_prefix}_EXTRA_BODY"] = coerce_env_value(extra_body)

    return values


def _map_scalar_keys(table: dict[str, Any], key_map: dict[str, str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for key, env_key in key_map.items():
        if key in table and not isinstance(table[key], dict):
            values[env_key] = coerce_env_value(table[key])
    return values


def _collect_extra_body(
    table: dict[str, Any],
    *,
    reserved_keys: set[str],
) -> dict[str, Any]:
    extra_body: dict[str, Any] = {}

    explicit_extra_body = table.get("extra_body")
    if explicit_extra_body is not None:
        if not isinstance(explicit_extra_body, dict):
            raise ValueError(
                "`extra_body` 값은 TOML table 또는 inline table이어야 합니다."
            )
        extra_body.update(explicit_extra_body)

    for key, value in table.items():
        if key in reserved_keys or key == "extra_body" or key in PROVIDER_NAMES:
            continue
        extra_body[key] = value
    return extra_body


def _reject_legacy_keys(table: dict[str, Any], *, table_name: str) -> None:
    for key in table:
        if any(str(key).startswith(prefix) for prefix in _LEGACY_KEY_PREFIXES):
            raise ValueError(
                f"{table_name} 에는 legacy flat 키 `{key}` 를 사용할 수 없습니다. nested 구조를 사용하세요."
            )


def _reject_role_provider_subtables(role: str, table: dict[str, Any]) -> None:
    for provider_name in PROVIDER_NAMES:
        provider_table = table.get(provider_name)
        if provider_table is None:
            continue
        if isinstance(provider_table, dict):
            raise ValueError(
                f"[llm.{role}.{provider_name}] 문법은 더 이상 지원하지 않습니다. "
                f"[llm.{role}]에 provider-specific 키를 직접 두세요."
            )
