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

import math
import random
from collections import Counter
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


def select_active_actor_ids(
    *,
    actors: list[dict[str, object]],
    activity_feeds: dict[str, dict[str, object]],
    activities: list[dict[str, object]],
    observer_reports: list[dict[str, object]],
    next_step_index: int,
    rng_seed: int,
) -> list[str]:
    """observer 신호와 inbox 압력을 바탕으로 이번 단계 활성 actor를 고른다."""

    ordered_actor_ids = [str(actor["actor_id"]) for actor in actors]
    if len(ordered_actor_ids) <= 1:
        return ordered_actor_ids

    momentum, _ = latest_observer_signal(observer_reports)
    target_count = _target_active_count(
        actor_count=len(ordered_actor_ids),
        momentum=momentum,
    )
    if target_count >= len(ordered_actor_ids):
        return ordered_actor_ids

    unread_counts = {
        actor_id: len(
            _string_list(
                activity_feeds.get(actor_id, {}).get("unseen_activity_ids", [])
            )
        )
        for actor_id in ordered_actor_ids
    }
    recent_involvement = _recent_involvement_counts(
        activities=activities,
        next_step_index=next_step_index,
    )
    weights = {
        actor_id: _actor_selection_weight(
            unread_count=unread_counts.get(actor_id, 0),
            recent_involvement_count=recent_involvement.get(actor_id, 0),
            momentum=momentum,
        )
        for actor_id in ordered_actor_ids
    }

    selected_actor_ids = [
        actor_id for actor_id in ordered_actor_ids if unread_counts.get(actor_id, 0) > 0
    ]
    if len(selected_actor_ids) > target_count:
        selected_actor_ids = _weighted_sample_without_replacement(
            actor_ids=selected_actor_ids,
            weights=weights,
            target_count=target_count,
            rng=random.Random(f"{rng_seed}:active:{next_step_index}:priority"),
        )
    elif len(selected_actor_ids) < target_count:
        remaining_ids = [
            actor_id
            for actor_id in ordered_actor_ids
            if actor_id not in selected_actor_ids
        ]
        selected_actor_ids.extend(
            _weighted_sample_without_replacement(
                actor_ids=remaining_ids,
                weights=weights,
                target_count=target_count - len(selected_actor_ids),
                rng=random.Random(f"{rng_seed}:active:{next_step_index}:sample"),
            )
        )

    return [
        actor_id
        for actor_id in ordered_actor_ids
        if actor_id in set(selected_actor_ids)
    ]


def compute_observer_event_probability(
    *,
    latest_activities: list[dict[str, object]],
    observer_reports: list[dict[str, object]],
    stagnation_steps: int,
) -> float:
    """observer 사건 개입 확률을 현재 국면 기준으로 계산한다."""

    momentum, atmosphere = latest_observer_signal(observer_reports)
    probability = 0.35

    if momentum == "low":
        probability += 0.20
    elif momentum == "high":
        probability -= 0.10

    if stagnation_steps > 0:
        probability += min(0.10 * stagnation_steps, 0.25)

    activity_count = len(latest_activities)
    if activity_count == 0:
        probability += 0.10
    elif activity_count >= 3:
        probability -= 0.05

    if _repeated_thread_count(latest_activities) > 0:
        probability += 0.05

    probability += _atmosphere_probability_bias(atmosphere)
    return max(0.05, min(probability, 0.90))


def roll_observer_event(
    *,
    rng_seed: int,
    step_index: int,
    stagnation_steps: int,
) -> float:
    """observer 사건 판정용 재현 가능한 난수를 만든다."""

    rng = random.Random(f"{rng_seed}:observer-event:{step_index}:{stagnation_steps}")
    return rng.random()


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


def _target_active_count(*, actor_count: int, momentum: str | None) -> int:
    if momentum == "low":
        return max(1, math.ceil(actor_count * 0.6))
    return actor_count


def _actor_selection_weight(
    *,
    unread_count: int,
    recent_involvement_count: int,
    momentum: str | None,
) -> float:
    weight = 1.0
    weight += unread_count * 2.0

    if recent_involvement_count == 0:
        weight += 0.75

    if momentum == "high":
        weight += min(recent_involvement_count, 3) * 0.25
    elif momentum == "low" and unread_count == 0:
        weight *= 0.70

    return max(weight, 0.05)


def _recent_involvement_counts(
    *,
    activities: list[dict[str, object]],
    next_step_index: int,
) -> Counter[str]:
    recent_start_step = max(1, next_step_index - 2)
    counts: Counter[str] = Counter()
    for activity in activities:
        step_index = int(str(activity.get("step_index", 0)))
        if step_index < recent_start_step:
            continue
        source_actor_id = str(activity.get("source_actor_id", ""))
        if source_actor_id:
            counts[source_actor_id] += 1
        for target_actor_id in _string_list(activity.get("target_actor_ids", [])):
            counts[target_actor_id] += 1
    return counts


def _weighted_sample_without_replacement(
    *,
    actor_ids: list[str],
    weights: dict[str, float],
    target_count: int,
    rng: random.Random,
) -> list[str]:
    if target_count <= 0 or not actor_ids:
        return []

    pool = list(actor_ids)
    selected: list[str] = []
    while pool and len(selected) < target_count:
        total_weight = sum(weights.get(actor_id, 1.0) for actor_id in pool)
        threshold = rng.uniform(0.0, total_weight)
        cumulative = 0.0
        chosen = pool[-1]
        for actor_id in pool:
            cumulative += weights.get(actor_id, 1.0)
            if cumulative >= threshold:
                chosen = actor_id
                break
        selected.append(chosen)
        pool.remove(chosen)
    return selected


def _repeated_thread_count(latest_activities: list[dict[str, object]]) -> int:
    thread_counts = Counter(
        str(activity.get("thread_id", "")).strip()
        for activity in latest_activities
        if str(activity.get("thread_id", "")).strip()
    )
    return sum(1 for count in thread_counts.values() if count > 1)


def _atmosphere_probability_bias(atmosphere: str | None) -> float:
    if atmosphere is None:
        return 0.0

    lowered = atmosphere.strip().lower()
    if any(keyword in lowered for keyword in ("혼란", "압박", "긴장", "불안")):
        return 0.05
    if any(keyword in lowered for keyword in ("안정", "완화", "정체", "고요")):
        return -0.05
    return 0.0


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
