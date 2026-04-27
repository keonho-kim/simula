"""Human-readable scene runtime logging."""

from __future__ import annotations

import logging
from typing import Any, cast


def log_scene_request(
    logger: logging.Logger,
    *,
    round_index: int,
    selected_event: dict[str, Any],
    scene_actors: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    compact_input: dict[str, Any],
) -> None:
    logger.info(
        "SCENE %s 시작 | event=%s | actors=%s | candidates=%s",
        round_index,
        str(selected_event.get("event_id", "")),
        ",".join(str(actor.get("cast_id", "")) for actor in scene_actors),
        len(candidates),
    )
    logger.debug(
        "SCENE %s 요청\n이벤트: %s\nagents:\n%s\n후보:\n%s\n입력: actors=%s actions=%s recent_effects=%s event_symbol=%s",
        round_index,
        str(selected_event.get("title", "")),
        render_agent_states_for_log(
            list(compact_input.get("agent_states", [])),
            actor_name_by_id(scene_actors),
        ),
        render_candidates_for_log(candidates, actor_name_by_id(scene_actors)),
        len(scene_actors),
        len(dict(dict(compact_input.get("symbols", {})).get("actions", {}))),
        len(list(compact_input.get("recent_effects", []))),
        dict(compact_input.get("symbols", {})).get("selected_event", "-"),
    )


def log_scene_result(
    logger: logging.Logger,
    *,
    round_index: int,
    scene_actors: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    scene_beats: list[dict[str, Any]],
    agent_updates: list[dict[str, Any]],
    actual_event_updates: list[dict[str, Any]],
    stop_reason: str,
    time_advance: dict[str, Any],
    meta: dict[str, Any],
) -> None:
    beat_actor_ids = [
        str(beat.get("source_cast_id", ""))
        for beat in scene_beats
        if str(beat.get("source_cast_id", "")).strip()
    ]
    logger.info(
        "SCENE %s 적용 | beats=%s | agent_updates=%s | event=%s | actors=%s | time +%s | stop %s",
        round_index,
        len(scene_beats),
        len(agent_updates),
        str(candidates[0].get("event_id", "")) if candidates else "-",
        ",".join(beat_actor_ids) or "-",
        str(time_advance.get("elapsed_label", "-")),
        stop_reason or "continue",
    )
    logger.debug(
        "SCENE %s 결과\nbeats:\n%s\nagent updates:\n%s\n사건 변화: %s건\n시간: +%s\n기본값: %s\nLLM: %.2fs | in=%s out=%s total=%s | fixer=%s",
        round_index,
        render_scene_beats_for_log(
            scene_beats,
            actor_name_by_id=actor_name_by_id(scene_actors),
            candidate_by_id={
                str(candidate.get("candidate_id", "")): candidate
                for candidate in candidates
            },
        ),
        render_agent_updates_for_log(
            agent_updates,
            actor_name_by_id(scene_actors),
        ),
        len(actual_event_updates),
        str(time_advance.get("elapsed_label", "-")),
        bool(meta.get("forced_default", False)),
        float(meta.get("duration_seconds", 0.0)),
        meta.get("input_tokens"),
        meta.get("output_tokens"),
        meta.get("total_tokens"),
        bool(meta.get("fixer_used", False)),
    )


def render_candidates_for_log(
    candidates: list[dict[str, Any]],
    actor_name_by_id: dict[str, str],
) -> str:
    if not candidates:
        return "-"
    lines: list[str] = []
    for candidate in candidates:
        source = actor_label(
            str(candidate.get("source_cast_id", "")),
            actor_name_by_id,
        )
        targets = actor_labels(
            [str(item) for item in list(candidate.get("target_cast_ids", []))],
            actor_name_by_id,
        )
        lines.append(
            (
                f"- {candidate.get('candidate_id')} | {source} | "
                f"{candidate.get('action_type')} -> {targets or '-'}"
            )
        )
        lines.extend(wrapped_log_field("의도", str(candidate.get("intent", ""))))
        lines.extend(wrapped_log_field("위험", str(candidate.get("risk", ""))))
        lines.extend(
            wrapped_log_field("예상효과", str(candidate.get("expected_effect", "")))
        )
    return "\n".join(lines)


def render_scene_beats_for_log(
    scene_beats: list[dict[str, Any]],
    *,
    actor_name_by_id: dict[str, str],
    candidate_by_id: dict[str, dict[str, Any]],
) -> str:
    if not scene_beats:
        return "-"
    lines: list[str] = []
    for beat in scene_beats:
        beat_id = str(beat.get("beat_id", ""))
        candidate_id = str(beat.get("candidate_id", ""))
        candidate = candidate_by_id.get(candidate_id, {})
        source = actor_label(
            str(beat.get("source_cast_id", "")),
            actor_name_by_id,
        )
        target_ids = [
            str(item)
            for item in list(
                beat.get("target_cast_ids", candidate.get("target_cast_ids", []))
            )
        ]
        targets = actor_labels(target_ids, actor_name_by_id)
        action_type = str(beat.get("action_type", candidate.get("action_type", "")))
        utterance = str(beat.get("utterance", ""))
        lines.append(
            f"- {beat_id}/{candidate_id} | {source} -> {targets or '-'} | {action_type}"
        )
        lines.extend(wrapped_log_field("의도", str(beat.get("intent", ""))))
        lines.extend(wrapped_log_field("행동", str(beat.get("summary", ""))))
        if utterance.strip():
            lines.extend(wrapped_log_field("발화", utterance))
        lines.extend(wrapped_log_field("반응", str(beat.get("reaction", ""))))
        lines.extend(wrapped_log_field("효과", str(beat.get("event_effect", ""))))
    return "\n".join(lines)


def render_agent_states_for_log(
    agent_states: list[object],
    actor_name_by_id: dict[str, str],
) -> str:
    if not agent_states:
        return "-"
    lines: list[str] = []
    for raw_state in agent_states:
        if not isinstance(raw_state, dict):
            continue
        state = cast(dict[str, Any], raw_state)
        cast_id = str(state.get("cast_id", ""))
        label = actor_label(cast_id, actor_name_by_id)
        lines.append(
            f"- {label} | pressure={state.get('pressure_level', 0)} "
            f"| cooldown={state.get('speech_cooldown', 0)}/{state.get('action_cooldown', 0)}"
        )
        lines.extend(wrapped_log_field("목표", str(state.get("current_intent", ""))))
        memory = _string_list(state.get("recent_memory", []))
        if memory:
            lines.extend(wrapped_log_field("기억", " / ".join(memory[:2])))
    return "\n".join(lines) if lines else "-"


def render_agent_updates_for_log(
    agent_updates: list[dict[str, Any]],
    actor_name_by_id: dict[str, str],
) -> str:
    if not agent_updates:
        return "-"
    lines: list[str] = []
    for update in agent_updates:
        cast_id = str(update.get("cast_id", ""))
        label = actor_label(cast_id, actor_name_by_id)
        lines.append(
            f"- {label} | pressure={update.get('pressure_level', 0)} "
            f"({int(update.get('pressure_delta', 0)):+d})"
        )
        lines.extend(wrapped_log_field("목표", str(update.get("current_intent", ""))))
        memory = _string_list(update.get("latest_memory", []))
        if memory:
            lines.extend(wrapped_log_field("기억", " / ".join(memory)))
    return "\n".join(lines)


def actor_name_by_id(scene_actors: list[dict[str, Any]]) -> dict[str, str]:
    return {
        str(actor.get("cast_id", "")): str(
            actor.get("display_name") or actor.get("cast_id", "")
        )
        for actor in scene_actors
        if str(actor.get("cast_id", "")).strip()
    }


def actor_label(cast_id: str, actor_name_by_id: dict[str, str]) -> str:
    return actor_name_by_id.get(cast_id) or cast_id or "-"


def actor_labels(
    cast_ids: list[str],
    actor_name_by_id: dict[str, str],
) -> str:
    return ", ".join(actor_label(cast_id, actor_name_by_id) for cast_id in cast_ids)


def wrapped_log_field(label: str, value: str, *, width: int = 100) -> list[str]:
    text = value.strip() or "-"
    prefix = f"  {label}: "
    continuation = " " * len(prefix)
    lines: list[str] = []
    current = ""
    for word in text.split():
        if current and len(current) + len(word) + 1 > width:
            lines.append(current)
            current = word
            continue
        current = f"{current} {word}".strip()
    if current:
        lines.append(current)
    return [
        f"{prefix}{line}" if index == 0 else f"{continuation}{line}"
        for index, line in enumerate(lines)
    ]


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]
