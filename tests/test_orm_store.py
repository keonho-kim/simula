"""목적:
- SQLAlchemy 앱 저장소의 기본 쓰기 경로를 검증한다.

설명:
- run, actor, activity, report 저장이 실제 SQLite DB 테이블에 반영되는지 확인한다.

사용한 설계 패턴:
- 저장소 통합 테스트 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.storage.app_store
"""

from __future__ import annotations

import json
import sqlite3

from simula.infrastructure.config.models import StorageConfig
from simula.infrastructure.storage.app_store import SqlAlchemyAppStore


def _build_sqlite_store(sqlite_path: str) -> SqlAlchemyAppStore:
    return SqlAlchemyAppStore(
        StorageConfig(
            provider="sqlite",
            sqlite_path=sqlite_path,
        )
    )


def test_orm_store_persists_runtime_artifacts(tmp_path) -> None:
    sqlite_path = tmp_path / "runtime.sqlite"
    store = _build_sqlite_store(str(sqlite_path))

    try:
        store.save_run_started(
            run_id="run-1",
            scenario_text="시나리오",
            settings_json={"log_level": "INFO"},
        )
        store.save_plan("run-1", {"simulation_objective": "관계 추적"})
        store.save_actors(
            "run-1",
            [
                {"actor_id": "a", "display_name": "A"},
                {"actor_id": "b", "display_name": "B"},
            ],
        )
        store.save_step_artifacts(
            "run-1",
            activities=[
                {
                    "activity_id": "a1",
                    "step_index": 1,
                    "source_actor_id": "a",
                    "visibility": "public",
                    "thread_id": None,
                    "created_at": "2026-04-10T00:00:00+00:00",
                }
            ],
            observer_report={
                "step_index": 1,
                "summary": "요약",
                "notable_events": ["발언"],
                "atmosphere": "긴장",
                "momentum": "medium",
                "world_state_summary": "공개 흐름이 시작됐다.",
            },
        )
        store.save_final_report(
            "run-1",
            {
                "run_id": "run-1",
                "scenario": "시나리오",
                "objective": "관계 추적",
                "world_summary": "요약",
                "world_state_summary": "공개 흐름이 시작됐다.",
                "elapsed_simulation_minutes": 30,
                "elapsed_simulation_label": "30분",
                "steps_completed": 1,
                "actor_count": 2,
                "total_activities": 1,
                "visibility_activity_counts": {"public": 1},
                "last_observer_summary": "요약",
                "notable_events": ["발언"],
                "errors": [],
            },
        )
        store.mark_run_status("run-1", "completed")
    finally:
        store.close()

    connection = sqlite3.connect(sqlite_path)
    try:
        run_row = connection.execute(
            "select status, plan_json, final_report_json from runs where run_id = ?",
            ("run-1",),
        ).fetchone()
        actor_count = connection.execute("select count(*) from actors").fetchone()[0]
        activity_count = connection.execute(
            "select count(*) from activities"
        ).fetchone()[0]
        observer_count = connection.execute(
            "select count(*) from observer_reports"
        ).fetchone()[0]

        assert run_row[0] == "completed"
        assert json.loads(run_row[1])["simulation_objective"] == "관계 추적"
        assert json.loads(run_row[2])["total_activities"] == 1
        assert actor_count == 2
        assert activity_count == 1
        assert observer_count == 1
    finally:
        connection.close()


def test_orm_store_next_run_id_is_sequential(tmp_path) -> None:
    sqlite_path = tmp_path / "runtime.sqlite"
    store = _build_sqlite_store(str(sqlite_path))

    try:
        first = store.next_run_id()
        store.save_run_started(
            run_id=first,
            scenario_text="시나리오",
            settings_json={"log_level": "INFO"},
        )
        second = store.next_run_id()
    finally:
        store.close()

    assert first.endswith(".1")
    assert second.endswith(".2")
