"""목적:
- planning 서브그래프의 상태 조각 타입을 정의한다.

설명:
- planning 단계가 쓰는 transient 채널과 결과 필드를 명시한다.

사용한 설계 패턴:
- 상태 조각 타입 패턴
"""

from __future__ import annotations

from typing import Any, TypedDict


class PlanningStateFragment(TypedDict, total=False):
    """planning 서브그래프 상태 조각이다."""

    pending_interpretation_core: str | None
    pending_progression_plan: dict[str, Any] | None
    pending_time_scope: dict[str, Any] | None
    pending_public_context: list[str]
    pending_private_context: list[str]
    pending_key_pressures: list[str]
    pending_observation_points: list[str]
    pending_interpretation: dict[str, Any] | None
    pending_situation: dict[str, Any] | None
    pending_action_catalog: dict[str, Any] | None
    action_catalog: dict[str, Any] | None
    pending_coordination_frame: dict[str, Any] | None
    coordination_frame: dict[str, Any] | None
    progression_plan: dict[str, Any] | None
    pending_cast_roster: list[dict[str, Any]]
    pending_plan: dict[str, Any] | None
    planning_latency_seconds: float
