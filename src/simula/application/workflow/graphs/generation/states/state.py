"""목적:
- generation 서브그래프의 상태 조각 타입을 정의한다.

설명:
- actor 생성 fan-out/fan-in에 필요한 채널 타입을 명시한다.

사용한 설계 패턴:
- 상태 조각 타입 패턴
"""

from __future__ import annotations

from typing import Any, TypedDict


class CastSlotSpec(TypedDict):
    """병렬 actor 생성용 cast slot 정보다."""

    slot_index: int
    cast_item: dict[str, Any]


class GeneratedActorResult(TypedDict):
    """병렬 actor 생성 결과다."""

    slot_index: int
    cast_id: str
    actor: dict[str, Any]
    latency_seconds: float
    parse_failure_count: int


class GenerationStateFragment(TypedDict, total=False):
    """generation 서브그래프 상태 조각이다."""

    pending_cast_slots: list[CastSlotSpec]
    cast_slot: CastSlotSpec
    generated_actor_results: list[GeneratedActorResult]
    pending_actors: list[dict[str, Any]]
    generation_started_at: float
    generation_latency_seconds: float
