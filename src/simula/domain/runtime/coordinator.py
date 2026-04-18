"""목적:
- coordinator용 후보 압축과 weighted sampling 정책을 제공한다.

설명:
- 전체 actor를 저비용 규칙으로 점수화하고, hard include/weighted/wildcard 슬롯을
  조합해 coordinator 후보 pool을 만든다.

사용한 설계 패턴:
- 순수 정책 함수 패턴
"""

from __future__ import annotations

import random
from collections import Counter
from typing import Literal, cast

from simula.domain.contracts import PressureLevel
from simula.domain.event_memory import build_event_pressure_map
from simula.domain.runtime.policy import latest_observer_signal

CandidateBucket = Literal["hard_include", "weighted", "wildcard"]
_CANDIDATE_POOL_LIMIT = 12
_MAX_HARD_INCLUDE = 3
_MAX_WEIGHTED = 7
_MAX_WILDCARD = 2

_TIER_BASE = {
    "lead": 4.0,
    "driver": 3.0,
    "support": 1.8,
    "background": 0.8,
}
_BACKGROUND_PRESSURE = {
    "low": 0.3,
    "medium": 0.7,
    "high": 1.2,
}


def build_focus_candidates(
    *,
    actors: list[dict[str, object]],
    activity_feeds: dict[str, dict[str, object]],
    activities: list[dict[str, object]],
    actor_intent_states: list[dict[str, object]],
    background_updates: list[dict[str, object]],
    event_memory: dict[str, object],
    round_focus_history: list[dict[str, object]],
    observer_reports: list[dict[str, object]],
    current_round_index: int,
    rng_seed: int,
) -> list[dict[str, object]]:
    """coordinator에 넘길 후보 actor pool을 구성한다."""

    if not actors:
        return []

    momentum, _ = latest_observer_signal(observer_reports)
    unread_counts = {
        str(actor["cast_id"]): len(
            _string_list(
                activity_feeds.get(str(actor["cast_id"]), {}).get(
                    "unseen_activity_ids", []
                )
            )
        )
        for actor in actors
    }
    targeted_counts = _recent_target_counts(
        activities=activities,
        current_round_index=current_round_index,
    )
    thread_counts = _recent_thread_counts(
        activities=activities,
        current_round_index=current_round_index,
    )
    intent_shift_flags = {
        str(snapshot.get("cast_id", "")): bool(snapshot.get("changed_from_previous"))
        for snapshot in actor_intent_states
    }
    background_pressure = _background_pressure_by_actor(
        background_updates=background_updates,
        current_round_index=current_round_index,
    )
    event_pressure = build_event_pressure_map(
        event_memory,
        current_round_index=current_round_index,
    )
    recent_focus_counts = _recent_focus_counts(
        round_focus_history=round_focus_history,
        current_round_index=current_round_index,
    )
    recent_activity_counts = _recent_activity_counts(
        activities=activities,
        current_round_index=current_round_index,
    )

    candidates = []
    for actor in actors:
        cast_id = str(actor["cast_id"])
        tier = str(actor.get("baseline_attention_tier", "background"))
        score = _TIER_BASE.get(tier, 0.8)
        reasons: list[str] = [f"기본 attention tier={tier}"]

        unread_count = unread_counts.get(cast_id, 0)
        if unread_count > 0:
            score += min(unread_count, 3) * 1.2
            reasons.append(f"unseen inbox {unread_count}건")

        targeted_count = targeted_counts.get(cast_id, 0)
        if targeted_count > 0:
            score += min(targeted_count, 2) * 1.0
            reasons.append(f"직접 target {targeted_count}회")

        if intent_shift_flags.get(cast_id, False):
            score += 1.2
            reasons.append("직전 intent 변화")

        thread_count = thread_counts.get(cast_id, 0)
        if thread_count > 0:
            score += min(thread_count, 2) * 0.8
            reasons.append(f"thread 관여 {thread_count}건")

        pressure_level = background_pressure.get(cast_id)
        if pressure_level is not None:
            score += _BACKGROUND_PRESSURE[pressure_level]
            reasons.append(f"background pressure {pressure_level}")

        event_pressure_info = event_pressure.get(cast_id, {})
        required_due_count = _int_value(event_pressure_info.get("required_due_count", 0))
        required_overdue_count = _int_value(
            event_pressure_info.get("required_overdue_count", 0)
        )
        optional_due_count = _int_value(event_pressure_info.get("optional_due_count", 0))
        optional_overdue_count = _int_value(
            event_pressure_info.get("optional_overdue_count", 0)
        )
        if required_due_count > 0:
            score += required_due_count * 1.6
            reasons.append(f"required due event {required_due_count}건")
        if required_overdue_count > 0:
            score += required_overdue_count * 2.2
            reasons.append(f"required overdue event {required_overdue_count}건")
        if optional_due_count > 0:
            score += optional_due_count * 0.8
            reasons.append(f"due event {optional_due_count}건")
        if optional_overdue_count > 0:
            score += optional_overdue_count * 1.1
            reasons.append(f"overdue event {optional_overdue_count}건")
        event_titles = cast(list[str], event_pressure_info.get("event_titles", []))
        if event_titles:
            reasons.append(f"event focus={', '.join(event_titles[:2])}")

        focus_count_last_two = sum(recent_focus_counts.get(cast_id, [])[:2])
        if focus_count_last_two == 0:
            score += 0.9
            reasons.append("최근 focus 비노출")

        if recent_activity_counts.get(cast_id, 0) == 0:
            score += 0.4
            reasons.append("최근 action 관여 희박")

        if recent_focus_counts.get(cast_id, [0])[0] > 0:
            score -= 1.2
            reasons.append("직전 focus 패널티")

        if sum(recent_focus_counts.get(cast_id, [])[:3]) >= 2:
            score -= 0.6
            reasons.append("최근 연속 focus 패널티")

        score = _apply_momentum_bias(
            score=score,
            momentum=momentum,
            cast_id=cast_id,
            quiet_bonus=(focus_count_last_two == 0),
            targeted_count=targeted_count,
            thread_count=thread_count,
        )
        candidates.append(
            {
                "cast_id": cast_id,
                "display_name": str(actor.get("display_name", cast_id)),
                "baseline_attention_tier": tier,
                "story_function": str(actor.get("story_function", "")),
                "candidate_score": max(0.2, round(score, 3)),
                "selection_bucket": "weighted",
                "reasons": reasons,
                "unseen_count": unread_count,
                "targeted_count": targeted_count,
                "thread_count": thread_count,
                "intent_shift": intent_shift_flags.get(cast_id, False),
                "background_pressure": pressure_level,
            }
        )

    by_cast_id = {str(item["cast_id"]): item for item in candidates}
    ordered_candidates = sorted(
        candidates,
        key=lambda item: (
            float(item["candidate_score"]),
            str(item["cast_id"]),
        ),
        reverse=True,
    )

    hard_include_ids: list[str] = []
    lead_driver_ids = [
        str(item["cast_id"])
        for item in ordered_candidates
        if str(item["baseline_attention_tier"]) in {"lead", "driver"}
    ]
    hard_include_ids.extend(lead_driver_ids[:2])
    direct_target_ids = [
        str(item["cast_id"])
        for item in ordered_candidates
        if int(item["targeted_count"]) > 0
        and str(item["cast_id"]) not in hard_include_ids
    ]
    hard_include_ids.extend(direct_target_ids[:1])
    if len(hard_include_ids) < _MAX_HARD_INCLUDE:
        shifted_ids = [
            str(item["cast_id"])
            for item in ordered_candidates
            if bool(item["intent_shift"])
            and str(item["cast_id"]) not in hard_include_ids
        ]
        hard_include_ids.extend(
            shifted_ids[: _MAX_HARD_INCLUDE - len(hard_include_ids)]
        )
    hard_include_ids = hard_include_ids[:_MAX_HARD_INCLUDE]

    for cast_id in hard_include_ids:
        by_cast_id[cast_id]["selection_bucket"] = "hard_include"

    remaining_ids = [
        str(item["cast_id"])
        for item in ordered_candidates
        if str(item["cast_id"]) not in hard_include_ids
    ]
    wildcard_source_ids = [
        cast_id
        for cast_id in remaining_ids
        if str(by_cast_id[cast_id]["baseline_attention_tier"])
        in {"support", "background"}
    ]
    wildcard_count = min(_MAX_WILDCARD, len(wildcard_source_ids))
    wildcard_ids = _weighted_sample_without_replacement(
        actor_ids=wildcard_source_ids,
        weights={
            cast_id: max(
                0.2,
                float(by_cast_id[cast_id]["candidate_score"]) * 0.5
                + (0.7 if bool(by_cast_id[cast_id]["intent_shift"]) else 0.0)
                + (0.4 if int(by_cast_id[cast_id]["unseen_count"]) == 0 else 0.0),
            )
            for cast_id in wildcard_source_ids
        },
        target_count=wildcard_count,
        rng=random.Random(f"{rng_seed}:coordinator:wildcard:{current_round_index}"),
    )
    for cast_id in wildcard_ids:
        by_cast_id[cast_id]["selection_bucket"] = "wildcard"

    weighted_source_ids = [
        cast_id for cast_id in remaining_ids if cast_id not in wildcard_ids
    ]
    weighted_target_count = min(
        _MAX_WEIGHTED,
        max(
            0,
            _CANDIDATE_POOL_LIMIT - len(hard_include_ids) - len(wildcard_ids),
        ),
        len(weighted_source_ids),
    )
    weighted_ids = _weighted_sample_without_replacement(
        actor_ids=weighted_source_ids,
        weights={
            cast_id: float(by_cast_id[cast_id]["candidate_score"])
            for cast_id in weighted_source_ids
        },
        target_count=weighted_target_count,
        rng=random.Random(f"{rng_seed}:coordinator:weighted:{current_round_index}"),
    )

    final_ids = hard_include_ids + weighted_ids + wildcard_ids
    unique_ids = []
    seen: set[str] = set()
    for cast_id in final_ids:
        if cast_id in seen:
            continue
        seen.add(cast_id)
        unique_ids.append(cast_id)

    return [
        by_cast_id[cast_id]
        for cast_id in [item["cast_id"] for item in ordered_candidates]
        if cast_id in seen
    ]


def _recent_target_counts(
    *,
    activities: list[dict[str, object]],
    current_round_index: int,
) -> Counter[str]:
    recent_start = max(1, current_round_index - 2)
    counts: Counter[str] = Counter()
    for activity in activities:
        round_index = int(str(activity.get("round_index", 0)))
        if round_index < recent_start:
            continue
        for cast_id in _string_list(activity.get("target_cast_ids", [])):
            counts[cast_id] += 1
    return counts


def _recent_thread_counts(
    *,
    activities: list[dict[str, object]],
    current_round_index: int,
) -> Counter[str]:
    recent_start = max(1, current_round_index - 2)
    counts: Counter[str] = Counter()
    for activity in activities:
        round_index = int(str(activity.get("round_index", 0)))
        if round_index < recent_start:
            continue
        if not str(activity.get("thread_id", "")).strip():
            continue
        source_cast_id = str(activity.get("source_cast_id", ""))
        if source_cast_id:
            counts[source_cast_id] += 1
        for cast_id in _string_list(activity.get("target_cast_ids", [])):
            counts[cast_id] += 1
    return counts


def _background_pressure_by_actor(
    *,
    background_updates: list[dict[str, object]],
    current_round_index: int,
) -> dict[str, PressureLevel]:
    pressure_by_actor: dict[str, PressureLevel] = {}
    recent_start = max(1, current_round_index - 1)
    for item in background_updates:
        round_index = int(str(item.get("round_index", 0)))
        if round_index < recent_start:
            continue
        cast_id = str(item.get("cast_id", ""))
        pressure_level = str(item.get("pressure_level", ""))
        if cast_id and pressure_level in _BACKGROUND_PRESSURE:
            pressure_by_actor[cast_id] = cast(PressureLevel, pressure_level)
    return pressure_by_actor


def _recent_focus_counts(
    *,
    round_focus_history: list[dict[str, object]],
    current_round_index: int,
) -> dict[str, list[int]]:
    recent_steps = [
        current_round_index - 1,
        current_round_index - 2,
        current_round_index - 3,
    ]
    counts: dict[str, list[int]] = {}
    history_by_step = {
        int(str(item.get("round_index", 0))): item for item in round_focus_history
    }
    for offset_index, round_index in enumerate(recent_steps):
        if round_index < 1:
            continue
        focus_plan = history_by_step.get(round_index, {})
        for cast_id in _string_list(focus_plan.get("selected_cast_ids", [])):
            counts.setdefault(cast_id, [0, 0, 0])[offset_index] += 1
    return counts


def _recent_activity_counts(
    *,
    activities: list[dict[str, object]],
    current_round_index: int,
) -> Counter[str]:
    recent_start = max(1, current_round_index - 3)
    counts: Counter[str] = Counter()
    for activity in activities:
        round_index = int(str(activity.get("round_index", 0)))
        if round_index < recent_start:
            continue
        source_cast_id = str(activity.get("source_cast_id", ""))
        if source_cast_id:
            counts[source_cast_id] += 1
        for cast_id in _string_list(activity.get("target_cast_ids", [])):
            counts[cast_id] += 1
    return counts


def _apply_momentum_bias(
    *,
    score: float,
    momentum: str | None,
    cast_id: str,
    quiet_bonus: bool,
    targeted_count: int,
    thread_count: int,
) -> float:
    del cast_id
    adjusted = score
    if momentum == "low":
        if quiet_bonus:
            adjusted += 0.45
        if targeted_count == 0 and thread_count == 0:
            adjusted += 0.15
    elif momentum == "high":
        adjusted += min(targeted_count, 2) * 0.2
        adjusted += min(thread_count, 2) * 0.2
    return adjusted


def _weighted_sample_without_replacement(
    *,
    actor_ids: list[str],
    weights: dict[str, float],
    target_count: int,
    rng: random.Random,
) -> list[str]:
    if target_count <= 0 or not actor_ids:
        return []

    remaining = list(actor_ids)
    selected: list[str] = []
    while remaining and len(selected) < target_count:
        total_weight = sum(
            max(weights.get(actor_id, 0.2), 0.2) for actor_id in remaining
        )
        threshold = rng.random() * total_weight
        cumulative = 0.0
        chosen = remaining[-1]
        for actor_id in remaining:
            cumulative += max(weights.get(actor_id, 0.2), 0.2)
            if cumulative >= threshold:
                chosen = actor_id
                break
        selected.append(chosen)
        remaining.remove(chosen)
    return selected


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0
