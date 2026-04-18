"""목적:
- 앱 저장소 인터페이스와 공통 예외를 정의한다.

설명:
- SQLite / PostgreSQL 구현이 같은 계약을 따르도록 공통 프로토콜을 제공한다.

사용한 설계 패턴:
- 저장소 포트 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.storage.app_store
- simula.application.services.executor
"""

from __future__ import annotations

from typing import Protocol


class StorageSchemaError(RuntimeError):
    """저장소 테이블 또는 스키마가 기대와 다를 때 발생한다."""


class AppStore(Protocol):
    """앱 저장소 공통 인터페이스다."""

    def close(self) -> None:
        """열린 리소스를 닫는다."""

    def save_run_started(
        self, *, run_id: str, scenario_text: str, settings_json: dict[str, object]
    ) -> None:
        """실행 시작 메타데이터를 저장한다."""

    def next_run_id(self, *, actor_model_id: str, scenario_file_stem: str) -> str:
        """현재 저장소 기준 다음 run_id 를 생성한다."""

    def save_plan(self, run_id: str, plan: dict[str, object]) -> None:
        """Planner 결과를 저장한다."""

    def save_actors(self, run_id: str, actors: list[dict[str, object]]) -> None:
        """actor 목록을 저장한다."""

    def save_round_artifacts(
        self,
        run_id: str,
        *,
        activities: list[dict[str, object]],
        observer_report: dict[str, object],
    ) -> None:
        """round activity와 observer 리포트를 함께 저장한다."""

    def save_final_report(self, run_id: str, report: dict[str, object]) -> None:
        """최종 리포트를 저장한다."""

    def mark_run_status(
        self, run_id: str, status: str, error_text: str | None = None
    ) -> None:
        """실행 상태를 업데이트한다."""
