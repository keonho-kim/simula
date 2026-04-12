"""목적:
- PostgreSQL 저장소 스키마 검증과 안내 메시지 생성을 담당한다.

설명:
- 누락 schema/table, 컬럼 불일치를 판별하고 bootstrap 명령과 DDL을 포함한 오류 메시지를 만든다.

사용한 설계 패턴:
- validation helper 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.storage.app_store
"""

from __future__ import annotations

from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.schema import CreateTable

from simula.application.ports.storage import StorageSchemaError
from simula.infrastructure.config.models import StorageConfig
from simula.infrastructure.storage.orm_models import (
    StoreModels,
    expected_app_table_columns,
)

CHECKPOINT_TABLE_COLUMNS: dict[str, set[str]] = {
    "checkpoint_migrations": {"v"},
    "checkpoints": {
        "thread_id",
        "checkpoint_ns",
        "checkpoint_id",
        "parent_checkpoint_id",
        "type",
        "checkpoint",
        "metadata",
    },
    "checkpoint_blobs": {
        "thread_id",
        "checkpoint_ns",
        "channel",
        "version",
        "type",
        "blob",
    },
    "checkpoint_writes": {
        "thread_id",
        "checkpoint_ns",
        "checkpoint_id",
        "task_id",
        "idx",
        "channel",
        "type",
        "blob",
        "task_path",
    },
}


def validate_sqlite_schema(
    *,
    models: StoreModels,
    engine: Engine,
) -> None:
    """SQLite 앱 테이블 컬럼 상태를 검증한다."""

    inspector = inspect(engine)
    mismatched_tables: list[str] = []

    for table_name, expected_columns in expected_app_table_columns(models).items():
        if not inspector.has_table(table_name):
            continue

        actual_columns = {
            str(column["name"]) for column in inspector.get_columns(table_name)
        }
        if actual_columns != expected_columns:
            mismatched_tables.append(
                f"{table_name}: expected={sorted(expected_columns)} actual={sorted(actual_columns)}"
            )

    if mismatched_tables:
        raise StorageSchemaError(
            "sqlite 테이블 스키마가 현재 애플리케이션 계약과 다릅니다.\n"
            "기존 runtime.sqlite 또는 trial SQLite 파일을 삭제하고 다시 생성하세요.\n"
            + "\n".join(mismatched_tables)
        )


def validate_postgresql_schema(
    *,
    storage: StorageConfig,
    models: StoreModels,
    engine: Engine,
    env_file_hint: str | None,
    checkpoint_enabled: bool,
) -> None:
    """PostgreSQL schema와 테이블 상태를 검증한다."""

    if storage.provider != "postgresql":
        return

    schema = storage.postgresql.schema
    inspector = inspect(engine)
    if schema not in inspector.get_schema_names():
        raise StorageSchemaError(
            build_missing_schema_message(
                storage,
                env_file_hint,
                checkpoint_enabled=checkpoint_enabled,
            )
        )

    missing_tables: list[str] = []
    mismatched_tables: list[str] = []

    for table_name, expected_columns in expected_app_table_columns(models).items():
        if not inspector.has_table(table_name, schema=schema):
            missing_tables.append(table_name)
            continue

        actual_columns = {
            str(column["name"])
            for column in inspector.get_columns(table_name, schema=schema)
        }
        if actual_columns != expected_columns:
            mismatched_tables.append(
                f"{table_name}: expected={sorted(expected_columns)} actual={sorted(actual_columns)}"
            )

    if checkpoint_enabled:
        for table_name, expected_columns in CHECKPOINT_TABLE_COLUMNS.items():
            if not inspector.has_table(table_name, schema=schema):
                missing_tables.append(table_name)
                continue

            actual_columns = {
                str(column["name"])
                for column in inspector.get_columns(table_name, schema=schema)
            }
            if not expected_columns.issubset(actual_columns):
                mismatched_tables.append(
                    f"{table_name}: expected subset={sorted(expected_columns)} actual={sorted(actual_columns)}"
                )

    if missing_tables or mismatched_tables:
        raise StorageSchemaError(
            build_schema_validation_message(
                storage=storage,
                models=models,
                engine=engine,
                missing_tables=missing_tables,
                mismatched_tables=mismatched_tables,
                env_file_hint=env_file_hint,
                checkpoint_enabled=checkpoint_enabled,
            )
        )


def build_missing_schema_message(
    storage: StorageConfig,
    env_file_hint: str | None,
    *,
    checkpoint_enabled: bool,
) -> str:
    """누락 schema 오류 메시지를 생성한다."""

    postgres = storage.postgresql
    psql_command = (
        "psql "
        f"-h {postgres.host} -p {postgres.port} -U {postgres.user} -d {postgres.database} "
        f"-c 'CREATE SCHEMA IF NOT EXISTS \"{postgres.schema}\";'"
    )
    bootstrap_command = build_bootstrap_command(env_file_hint)
    action_target = "앱/체크포인트 테이블" if checkpoint_enabled else "앱 테이블"
    return (
        f"postgresql schema `{postgres.schema}` 가 존재하지 않습니다.\n"
        f"다음 명령으로 schema를 생성할 수 있습니다:\n{psql_command}\n"
        f"{action_target} 생성은 다음 명령을 사용하세요:\n{bootstrap_command}"
    )


def build_schema_validation_message(
    *,
    storage: StorageConfig,
    models: StoreModels,
    engine: Engine,
    missing_tables: list[str],
    mismatched_tables: list[str],
    env_file_hint: str | None,
    checkpoint_enabled: bool,
) -> str:
    """스키마 불일치 오류 메시지를 생성한다."""

    ddl_lines = render_app_table_ddl(models, engine)
    message_lines = [
        f"postgresql schema `{storage.postgresql.schema}` 의 테이블 상태가 기대와 다릅니다.",
    ]
    if missing_tables:
        message_lines.append(f"누락 테이블: {', '.join(sorted(missing_tables))}")
    if mismatched_tables:
        message_lines.append("스키마 불일치:")
        message_lines.extend(mismatched_tables)
    message_lines.append("앱 테이블 DDL:")
    message_lines.extend(ddl_lines)
    action_target = "체크포인트 및 앱 테이블" if checkpoint_enabled else "앱 테이블"
    message_lines.append(
        f"{action_target}을 자동 생성하려면 다음 명령을 실행하세요:\n{build_bootstrap_command(env_file_hint)}"
    )
    return "\n".join(message_lines)


def render_app_table_ddl(models: StoreModels, engine: Engine) -> list[str]:
    """앱 테이블 DDL 문자열 목록을 만든다."""

    lines: list[str] = []
    for table in models.base.metadata.sorted_tables:
        compiled = str(CreateTable(table).compile(dialect=engine.dialect))
        lines.append(compiled.rstrip(";") + ";")
    return lines


def build_bootstrap_command(env_file_hint: str | None) -> str:
    """사용자 안내용 bootstrap 명령을 생성한다."""

    if env_file_hint:
        return (
            "uv run python -m simula.infrastructure.storage.schema_bootstrap "
            f"--env {env_file_hint}"
        )
    return "uv run python -m simula.infrastructure.storage.schema_bootstrap"
