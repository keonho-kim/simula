"""목적:
- SQLAlchemy ORM 테이블 모델 생성을 담당한다.

설명:
- 저장소 설정에 따라 schema/table 이름이 반영된 ORM 모델 묶음을 만든다.

사용한 설계 패턴:
- dynamic ORM model builder 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.storage.app_store
- simula.infrastructure.storage.schema_validation
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast

from sqlalchemy import JSON, DateTime, Integer, PrimaryKeyConstraint, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from simula.infrastructure.config.models import StorageConfig


@dataclass(slots=True)
class StoreModels:
    """저장소 ORM 모델 묶음이다."""

    base: type[DeclarativeBase]
    run_record: type[DeclarativeBase]
    actor_record: type[DeclarativeBase]
    activity_record: type[DeclarativeBase]
    observer_report_record: type[DeclarativeBase]
    final_report_record: type[DeclarativeBase]


def build_store_models(storage: StorageConfig) -> StoreModels:
    """Storage 설정으로 ORM 모델 클래스를 생성한다."""

    schema = storage.postgresql.schema if storage.provider == "postgresql" else None
    tables = storage.postgresql.tables

    class Base(DeclarativeBase):
        pass

    class RunRecord(Base):
        __tablename__ = tables.runs
        __table_args__ = {"schema": schema} if schema else {}

        run_id: Mapped[str] = mapped_column(String, primary_key=True)
        scenario_text: Mapped[str] = mapped_column(Text, nullable=False)
        status: Mapped[str] = mapped_column(String, nullable=False)
        settings_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
        plan_json: Mapped[dict[str, object] | None] = mapped_column(JSON)
        final_report_json: Mapped[dict[str, object] | None] = mapped_column(JSON)
        error_text: Mapped[str | None] = mapped_column(Text)
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), nullable=False
        )
        updated_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), nullable=False
        )

    class ActorRecord(Base):
        __tablename__ = tables.actors
        __table_args__ = (
            PrimaryKeyConstraint("run_id", "actor_id"),
            {"schema": schema} if schema else {},
        )

        run_id: Mapped[str] = mapped_column(String, nullable=False)
        actor_id: Mapped[str] = mapped_column(String, nullable=False)
        actor_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), nullable=False
        )

    class ActivityRecord(Base):
        __tablename__ = tables.activities
        __table_args__ = {"schema": schema} if schema else {}

        activity_id: Mapped[str] = mapped_column(String, primary_key=True)
        run_id: Mapped[str] = mapped_column(String, nullable=False)
        step_index: Mapped[int] = mapped_column(Integer, nullable=False)
        source_actor_id: Mapped[str] = mapped_column(String, nullable=False)
        visibility: Mapped[str] = mapped_column(String, nullable=False)
        thread_id: Mapped[str | None] = mapped_column(String)
        activity_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), nullable=False
        )

    class ObserverReportRecord(Base):
        __tablename__ = tables.observer_reports
        __table_args__ = (
            PrimaryKeyConstraint("run_id", "step_index"),
            {"schema": schema} if schema else {},
        )

        run_id: Mapped[str] = mapped_column(String, nullable=False)
        step_index: Mapped[int] = mapped_column(Integer, nullable=False)
        report_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), nullable=False
        )

    class FinalReportRecord(Base):
        __tablename__ = tables.final_reports
        __table_args__ = {"schema": schema} if schema else {}

        run_id: Mapped[str] = mapped_column(String, primary_key=True)
        report_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
        created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), nullable=False
        )

    return StoreModels(
        base=Base,
        run_record=RunRecord,
        actor_record=ActorRecord,
        activity_record=ActivityRecord,
        observer_report_record=ObserverReportRecord,
        final_report_record=FinalReportRecord,
    )


def expected_app_table_columns(models: StoreModels) -> dict[str, set[str]]:
    """앱 테이블별 기대 컬럼 집합을 계산한다."""

    expected: dict[str, set[str]] = {}
    for model in (
        models.run_record,
        models.actor_record,
        models.activity_record,
        models.observer_report_record,
        models.final_report_record,
    ):
        table = cast(Any, model.__table__)
        expected[str(table.name)] = {str(column.name) for column in table.columns}
    return expected
