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

from pydantic import ValidationError

from simula.domain.contracts import ActorIntentSnapshot, ObserverReport


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
                actor_id=str(actor["actor_id"]),
                current_intent=private_goal,
                target_actor_ids=[],
                supporting_action_type="initial_state",
                confidence=0.5,
                changed_from_previous=False,
            ).model_dump(mode="json")
        )
    return snapshots


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
    except ValidationError, ValueError, TypeError:
        momentum = raw_report.get("momentum")
        atmosphere = raw_report.get("atmosphere")
        return _string_or_none(momentum), _string_or_none(atmosphere)


def _string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
