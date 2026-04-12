"""목적:
- 저장소와 checkpointer 생성 조합을 제공한다.

설명:
- DB provider에 따라 앱 저장소와 LangGraph checkpointer를 함께 조립한다.

사용한 설계 패턴:
- factory 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.storage.app_store
- simula.application.services.executor
"""

from __future__ import annotations

from contextlib import AbstractAsyncContextManager, asynccontextmanager
from pathlib import Path
from typing import Any

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from simula.application.ports.storage import AppStore
from simula.infrastructure.config.models import AppSettings
from simula.infrastructure.storage.app_store import SqlAlchemyAppStore
from simula.infrastructure.storage.connection import build_postgresql_conn_string


def create_app_store(
    settings: AppSettings,
    *,
    env_file_hint: str | None = None,
    bootstrap_schema: bool = False,
) -> AppStore:
    """설정에 맞는 앱 저장소를 생성한다."""

    return SqlAlchemyAppStore(
        settings.storage,
        env_file_hint=env_file_hint,
        bootstrap_schema=bootstrap_schema,
        checkpoint_enabled=settings.runtime.enable_checkpointing,
    )


def create_async_checkpointer_context(
    settings: AppSettings,
) -> AbstractAsyncContextManager[Any | None]:
    """설정에 맞는 비동기 LangGraph checkpointer context manager를 생성한다."""

    if not settings.runtime.enable_checkpointing:
        return _null_checkpointer_context()

    if settings.storage.provider == "sqlite":
        return AsyncSqliteSaver.from_conn_string(_sqlite_checkpoint_path(settings))

    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

    return AsyncPostgresSaver.from_conn_string(
        build_postgresql_conn_string(settings.storage.postgresql)
    )


def _sqlite_checkpoint_path(settings: AppSettings) -> str:
    sqlite_path = Path(settings.storage.sqlite_path)
    checkpoint_name = f"{sqlite_path.stem}.checkpoints{sqlite_path.suffix or '.sqlite'}"
    return str(sqlite_path.with_name(checkpoint_name))


@asynccontextmanager
async def _null_checkpointer_context() -> Any:
    yield None
