"""목적:
- SQLite/PostgreSQL 공통 SQLAlchemy ORM 저장소를 제공한다.

설명:
- ORM 모델, 엔진 생성, 스키마 검증 모듈을 조합해 실제 저장 동작만 담당한다.

사용한 설계 패턴:
- ORM repository 패턴

연관된 다른 모듈/구조:
- simula.application.ports.storage
- simula.infrastructure.storage.connection
- simula.infrastructure.storage.orm_models
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast

from sqlalchemy import Integer, cast as sql_cast, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from simula.application.ports.storage import AppStore
from simula.domain.activities import iso_timestamp
from simula.infrastructure.config.models import StorageConfig
from simula.infrastructure.storage.connection import (
    create_storage_engine,
    ensure_sqlite_parent_dir,
)
from simula.infrastructure.storage.orm_models import build_store_models
from simula.infrastructure.storage.schema_validation import (
    validate_postgresql_schema,
    validate_sqlite_schema,
)


class RunIdConflictError(RuntimeError):
    """동시 실행으로 run_id가 충돌할 때 발생한다."""


class SqlAlchemyAppStore(AppStore):
    """SQLAlchemy 기반 앱 저장소다."""

    def __init__(
        self,
        storage: StorageConfig,
        *,
        env_file_hint: str | None = None,
        bootstrap_schema: bool = False,
        checkpoint_enabled: bool = False,
    ) -> None:
        self.storage = storage
        self.env_file_hint = env_file_hint
        self.checkpoint_enabled = checkpoint_enabled
        self.models = build_store_models(storage)
        self.engine = create_storage_engine(storage)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

        if storage.provider == "sqlite":
            ensure_sqlite_parent_dir(storage)
            self.models.base.metadata.create_all(self.engine)
            validate_sqlite_schema(models=self.models, engine=self.engine)
        else:
            if bootstrap_schema:
                self.bootstrap_postgresql_schema()
            else:
                validate_postgresql_schema(
                    storage=self.storage,
                    models=self.models,
                    engine=self.engine,
                    env_file_hint=self.env_file_hint,
                    checkpoint_enabled=self.checkpoint_enabled,
                )

    def close(self) -> None:
        self.engine.dispose()

    def bootstrap_postgresql_schema(self) -> None:
        """PostgreSQL schema와 앱 테이블을 생성한다."""

        if self.storage.provider != "postgresql":
            self.models.base.metadata.create_all(self.engine)
            return

        schema = self.storage.postgresql.schema
        with self.engine.begin() as connection:
            connection.exec_driver_sql(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
        self.models.base.metadata.create_all(self.engine)

    def save_run_started(
        self, *, run_id: str, scenario_text: str, settings_json: dict[str, object]
    ) -> None:
        timestamp = _parse_timestamp(iso_timestamp())
        record = self.models.run_record(
            run_id=run_id,
            scenario_text=scenario_text,
            status="running",
            settings_json=settings_json,
            created_at=timestamp,
            updated_at=timestamp,
        )
        with self.session_factory() as session:
            session.add(record)
            try:
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                raise RunIdConflictError(run_id) from exc

    def next_run_id(self) -> str:
        prefix = datetime.now().astimezone().date().isoformat()
        prefix_pattern = f"{prefix}.%"
        suffix_start_index = len(prefix) + 2
        with self.session_factory() as session:
            run_table = cast(Any, self.models.run_record.__table__)
            if self.storage.provider == "sqlite":
                suffix_expr = sql_cast(
                    func.substr(run_table.c.run_id, suffix_start_index),
                    Integer,
                )
            else:
                suffix_expr = sql_cast(
                    func.substring(run_table.c.run_id, suffix_start_index),
                    Integer,
                )
            max_number = session.scalar(
                select(func.max(suffix_expr)).where(
                    run_table.c.run_id.like(prefix_pattern)
                )
            )
        return f"{prefix}.{int(max_number or 0) + 1}"

    def save_plan(self, run_id: str, plan: dict[str, object]) -> None:
        with self.session_factory() as session:
            record = cast(Any, session.get(self.models.run_record, run_id))
            if record is None:
                raise ValueError(f"run_id `{run_id}` 를 찾을 수 없습니다.")
            record.plan_json = plan
            record.updated_at = _parse_timestamp(iso_timestamp())
            session.commit()

    def save_actors(self, run_id: str, actors: list[dict[str, object]]) -> None:
        timestamp = _parse_timestamp(iso_timestamp())
        with self.session_factory() as session:
            for actor in actors:
                session.merge(
                    self.models.actor_record(
                        run_id=run_id,
                        actor_id=str(actor["actor_id"]),
                        actor_json=actor,
                        created_at=timestamp,
                    )
                )
            session.commit()

    def save_step_artifacts(
        self,
        run_id: str,
        *,
        activities: list[dict[str, object]],
        observer_report: dict[str, object],
    ) -> None:
        """activity와 observer 리포트를 한 트랜잭션으로 저장한다."""

        with self.session_factory() as session:
            for activity in activities:
                session.merge(
                    self.models.activity_record(
                        run_id=run_id,
                        activity_id=str(activity["activity_id"]),
                        step_index=int(str(activity["step_index"])),
                        source_actor_id=str(activity["source_actor_id"]),
                        visibility=str(activity["visibility"]),
                        thread_id=cast(str | None, activity.get("thread_id")),
                        activity_json=activity,
                        created_at=_parse_timestamp(str(activity["created_at"])),
                    )
                )
            session.merge(
                self.models.observer_report_record(
                    run_id=run_id,
                    step_index=int(str(observer_report["step_index"])),
                    report_json=observer_report,
                    created_at=_parse_timestamp(iso_timestamp()),
                )
            )
            session.commit()

    def save_final_report(self, run_id: str, report: dict[str, object]) -> None:
        timestamp = _parse_timestamp(iso_timestamp())
        with self.session_factory() as session:
            session.merge(
                self.models.final_report_record(
                    run_id=run_id,
                    report_json=report,
                    created_at=timestamp,
                )
            )
            record = cast(Any, session.get(self.models.run_record, run_id))
            if record is not None:
                record.final_report_json = report
                record.updated_at = timestamp
            session.commit()

    def mark_run_status(
        self, run_id: str, status: str, error_text: str | None = None
    ) -> None:
        with self.session_factory() as session:
            record = cast(Any, session.get(self.models.run_record, run_id))
            if record is None:
                raise ValueError(f"run_id `{run_id}` 를 찾을 수 없습니다.")
            record.status = status
            record.error_text = error_text
            record.updated_at = _parse_timestamp(iso_timestamp())
            session.commit()


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value)
