"""목적:
- 저장소 연결 URL과 SQLAlchemy 엔진 생성을 담당한다.

설명:
- SQLite/PostgreSQL별 URL 생성 규칙과 로컬 디렉터리 준비를 한 곳에서 관리한다.

사용한 설계 패턴:
- connection factory 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.storage.app_store
- simula.infrastructure.storage.factory
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, URL

from simula.infrastructure.config.models import PostgreSQLConfig, StorageConfig


def create_storage_engine(storage: StorageConfig) -> Engine:
    """저장소 설정으로 SQLAlchemy 엔진을 생성한다."""

    if storage.provider == "sqlite":
        return create_engine(build_sqlite_url(storage), future=True)
    return create_engine(
        build_postgresql_sqlalchemy_url(storage.postgresql),
        future=True,
    )


def build_sqlite_url(storage: StorageConfig) -> str:
    """SQLite SQLAlchemy URL을 생성한다."""

    return f"sqlite:///{Path(storage.sqlite_path).expanduser()}"


def build_postgresql_conn_string(postgresql: PostgreSQLConfig) -> str:
    """LangGraph용 PostgreSQL 연결 문자열을 생성한다."""

    url = URL.create(
        "postgresql",
        username=postgresql.user,
        password=postgresql.password,
        host=postgresql.host,
        port=postgresql.port,
        database=postgresql.database,
        query={"options": f"-csearch_path={postgresql.db_schema}"},
    )
    return url.render_as_string(hide_password=False)


def build_postgresql_sqlalchemy_url(postgresql: PostgreSQLConfig) -> str:
    """SQLAlchemy용 PostgreSQL 연결 문자열을 생성한다."""

    url = URL.create(
        "postgresql+psycopg",
        username=postgresql.user,
        password=postgresql.password,
        host=postgresql.host,
        port=postgresql.port,
        database=postgresql.database,
        query={"options": f"-csearch_path={postgresql.db_schema}"},
    )
    return url.render_as_string(hide_password=False)


def ensure_sqlite_parent_dir(storage: StorageConfig) -> None:
    """SQLite 파일 상위 디렉터리를 보장한다."""

    Path(storage.sqlite_path).expanduser().parent.mkdir(parents=True, exist_ok=True)
