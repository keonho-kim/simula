"""목적:
- runtime의 확률 선택과 상태 기반 분기 정책을 제공한다.

설명:
- observer 신호, actor feed, 최근 activity, run seed를 함께 사용해
  활성 actor 선택, 사건 개입 확률, 정체 누적 규칙을 계산한다.

사용한 설계 패턴:
- 순수 정책 함수 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.runtime.nodes.lifecycle
- simula.application.workflow.graphs.runtime.nodes.observation
- simula.domain.contracts
"""

from __future__ import annotations

from hashlib import sha256
from typing import cast

from pydantic import ValidationError

from simula.domain.contracts import (
    ActorFacingScenarioDigest,
    ActorIntentSnapshot,
    ObserverReport,
)


def derive_rng_seed(*, run_id: str, configured_seed: int | None) -> int:
    """run별 기본 seed를 계산한다."""

    if configured_seed is not None:
        return int(configured_seed)

    digest = sha256(run_id.encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def build_initial_intent_snapshots(
    actors: list[dict[str, object]],
) -> list[dict[str, object]]:
    """runtime 시작 시 actor별 초기 intent snapshot을 만든다."""

    snapshots: list[dict[str, object]] = []
    for actor in actors:
        private_goal = str(actor.get("private_goal", "")).strip()
        if not private_goal:
            private_goal = "현재 상황을 보며 다음 행동 방향을 정리한다."
        snapshots.append(
            ActorIntentSnapshot(
                cast_id=str(actor["cast_id"]),
                current_intent=private_goal,
                thought=f"{str(actor.get('display_name', actor['cast_id']))}는 아직 관계 판도를 더 읽어야 한다고 본다.",
                target_cast_ids=[],
                supporting_action_type="initial_state",
                confidence=0.5,
                changed_from_previous=False,
            ).model_dump(mode="json")
        )
    return snapshots


def build_initial_actor_facing_scenario_digest(
    plan: dict[str, object],
) -> dict[str, object]:
    """runtime 시작용 actor-facing digest를 만든다."""

    situation = _dict_value(plan.get("situation", {}))
    interpretation = _dict_value(plan.get("interpretation", {}))
    world_summary = str(
        situation.get("world_summary")
        or interpretation.get("brief_summary")
        or "초기 관계 판도는 아직 유동적이다."
    ).strip()
    current_pressures = _string_list(interpretation.get("key_pressures"))[:3]
    if not current_pressures:
        current_pressures = ["초기 관계 구도가 아직 고정되지 않았다."]
    talking_points = _string_list(situation.get("initial_tensions"))[:3]
    if not talking_points:
        talking_points = ["상대의 반응을 시험할 수 있는 분명한 말부터 꺼낸다."]
    major_events = [
        cast(dict[str, object], item)
        for item in cast(list[object], plan.get("major_events", []))
        if isinstance(item, dict)
    ]
    if major_events:
        event_titles = [
            str(item.get("title", "")).strip()
            for item in major_events[:2]
            if str(item.get("title", "")).strip()
        ]
        if event_titles:
            current_pressures = [
                *event_titles,
                *_string_list(interpretation.get("key_pressures")),
            ][:3]
        event_summaries = [
            str(item.get("summary", "")).strip()
            for item in major_events[:2]
            if str(item.get("summary", "")).strip()
        ]
        if event_summaries:
            talking_points = [*event_summaries, *talking_points][:3]
    avoid_repetition_notes = _string_list(situation.get("current_constraints"))[:3]
    if not avoid_repetition_notes:
        avoid_repetition_notes = ["이미 나온 말만 반복하지 말고 관계를 움직일 새 포인트를 만든다."]

    return ActorFacingScenarioDigest(
        round_index=0,
        relationship_map_summary=world_summary,
        current_pressures=current_pressures,
        talking_points=talking_points,
        avoid_repetition_notes=avoid_repetition_notes,
        recommended_tone="상황을 읽되 분명한 의도를 드러내는 톤",
        world_state_summary=world_summary,
    ).model_dump(mode="json")


def next_stagnation_steps(
    *,
    previous_stagnation_steps: int,
    latest_activities: list[dict[str, object]],
    momentum: str | None,
) -> int:
    """이번 observer 결과를 반영한 정체 누적 값을 계산한다."""

    if not latest_activities:
        return previous_stagnation_steps + 1
    if momentum == "low" and len(latest_activities) <= 1:
        return previous_stagnation_steps + 1
    return 0


def latest_observer_signal(
    observer_reports: list[dict[str, object]],
) -> tuple[str | None, str | None]:
    """가장 최근 observer 신호를 안전하게 읽는다."""

    if not observer_reports:
        return None, None

    raw_report = observer_reports[-1]
    try:
        report = ObserverReport.model_validate(raw_report)
        return report.momentum, report.atmosphere
    except (ValidationError, ValueError, TypeError):
        momentum = raw_report.get("momentum")
        atmosphere = raw_report.get("atmosphere")
        return _string_or_none(momentum), _string_or_none(atmosphere)


def _string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _dict_value(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return {str(key): item for key, item in value.items()}


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
