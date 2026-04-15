"""Purpose:
- Load and validate one run's JSONL file for analyzer inputs.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import cast

from simula.application.analysis.models import (
    ActorRecord,
    AdoptedActivityRecord,
    LLMCallRecord,
    LoadedRunAnalysis,
    PlannedActionRecord,
)


def load_run_analysis(
    path: Path,
    *,
    expected_run_id: str,
) -> LoadedRunAnalysis:
    """Load one JSONL run log and normalize supported event payloads."""

    if not expected_run_id.strip():
        raise ValueError("run_id는 비어 있으면 안 됩니다.")
    if not path.exists():
        raise ValueError(f"simulation.log.jsonl 파일이 없습니다: {path}")
    if not path.is_file():
        raise ValueError(f"simulation.log.jsonl 경로가 파일이 아닙니다: {path}")

    entries = _read_jsonl_entries(path)
    llm_calls: list[LLMCallRecord] = []
    actors_by_id: dict[str, ActorRecord] = {}
    adopted_activities: list[AdoptedActivityRecord] = []
    planned_actions: list[PlannedActionRecord] = []
    planned_max_rounds = 0
    has_plan_finalized_event = False
    has_actors_finalized_event = False
    has_round_actions_adopted_event = False

    for entry in entries:
        _validate_run_id(entry, expected_run_id=expected_run_id)
        event_name = str(entry.get("event", "")).strip()
        if event_name == "llm_call":
            llm_calls.append(_parse_llm_call(entry))
            continue
        if event_name == "actors_finalized":
            has_actors_finalized_event = True
            actors_by_id = _parse_actors(entry)
            continue
        if event_name == "plan_finalized":
            has_plan_finalized_event = True
            planned_actions = _parse_planned_actions(entry)
            planned_max_rounds = _parse_planned_max_rounds(entry)
            continue
        if event_name == "round_actions_adopted":
            has_round_actions_adopted_event = True
            adopted_activities.extend(_parse_adopted_activities(entry))

    if not llm_calls:
        raise ValueError("simulation log에 llm_call 이벤트가 없습니다.")

    return LoadedRunAnalysis(
        run_id=expected_run_id,
        source_path=path,
        event_count=len(entries),
        llm_calls=sorted(llm_calls, key=lambda item: item.sequence),
        actors_by_id=actors_by_id,
        adopted_activities=sorted(
            adopted_activities,
            key=lambda item: (item.round_index, item.source_cast_id, item.thread_id),
        ),
        has_actors_finalized_event=has_actors_finalized_event,
        has_round_actions_adopted_event=has_round_actions_adopted_event,
        planned_actions=planned_actions,
        planned_max_rounds=planned_max_rounds,
        has_plan_finalized_event=has_plan_finalized_event,
    )


def _read_jsonl_entries(path: Path) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            stripped = raw_line.strip()
            if not stripped:
                continue
            try:
                loaded = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"{line_number}번째 줄의 JSONL 형식이 올바르지 않습니다: {exc}"
                ) from exc
            if not isinstance(loaded, dict):
                raise ValueError(
                    f"{line_number}번째 JSONL 엔트리는 객체여야 합니다."
                )
            entries.append(cast(dict[str, object], loaded))
    if not entries:
        raise ValueError(f"simulation log is empty: {path}")
    return entries


def _validate_run_id(entry: dict[str, object], *, expected_run_id: str) -> None:
    run_id = str(entry.get("run_id", "")).strip()
    if not run_id:
        return
    if run_id != expected_run_id:
        raise ValueError(
            "simulation log 안의 run_id가 요청한 값과 다릅니다: "
            f"expected `{expected_run_id}`, found `{run_id}`."
        )


def _parse_llm_call(entry: dict[str, object]) -> LLMCallRecord:
    role = str(entry.get("role", "")).strip()
    if not role:
        raise ValueError("llm_call 이벤트에 `role` 필드가 없습니다.")
    log_context = entry.get("log_context")
    if isinstance(log_context, dict):
        normalized_log_context = cast(dict[str, object], log_context)
    else:
        normalized_log_context = {}
    return LLMCallRecord(
        run_id=str(entry.get("run_id", "")),
        sequence=_int_value(entry.get("sequence", 0)),
        role=role,
        call_kind=str(entry.get("call_kind", "")).strip(),
        prompt=str(entry.get("prompt", "")),
        raw_response=str(entry.get("raw_response", "")),
        log_context=normalized_log_context,
        duration_seconds=_float_value(entry.get("duration_seconds", 0.0), 0.0),
        ttft_seconds=_optional_float_value(entry.get("ttft_seconds")),
        input_tokens=_optional_int_value(entry.get("input_tokens")),
        output_tokens=_optional_int_value(entry.get("output_tokens")),
        total_tokens=_optional_int_value(entry.get("total_tokens")),
    )


def _parse_actors(entry: dict[str, object]) -> dict[str, ActorRecord]:
    actors_by_id: dict[str, ActorRecord] = {}
    raw_actors = entry.get("actors", [])
    if not isinstance(raw_actors, list):
        return actors_by_id
    for raw_actor in raw_actors:
        if not isinstance(raw_actor, dict):
            continue
        actor_dict = cast(dict[str, object], raw_actor)
        cast_id = str(actor_dict.get("cast_id", "")).strip()
        if not cast_id:
            continue
        display_name = str(actor_dict.get("display_name", cast_id)).strip() or cast_id
        actors_by_id[cast_id] = ActorRecord(cast_id=cast_id, display_name=display_name)
    return actors_by_id


def _parse_adopted_activities(
    entry: dict[str, object],
) -> list[AdoptedActivityRecord]:
    records: list[AdoptedActivityRecord] = []
    raw_activities = entry.get("activities", [])
    if not isinstance(raw_activities, list):
        return records
    event_round_index = _int_value(entry.get("round_index", 0))
    for raw_activity in raw_activities:
        if not isinstance(raw_activity, dict):
            continue
        activity_dict = cast(dict[str, object], raw_activity)
        source_cast_id = str(activity_dict.get("source_cast_id", "")).strip()
        if not source_cast_id:
            continue
        records.append(
            AdoptedActivityRecord(
                round_index=_int_value(activity_dict.get("round_index", event_round_index)),
                source_cast_id=source_cast_id,
                target_cast_ids=_string_list(activity_dict.get("target_cast_ids", [])),
                intent_target_cast_ids=_string_list(
                    activity_dict.get("intent_target_cast_ids", [])
                ),
                visibility=str(activity_dict.get("visibility", "")).strip(),
                thread_id=str(activity_dict.get("thread_id", "")).strip(),
                action_type=str(activity_dict.get("action_type", "")).strip(),
                intent=str(activity_dict.get("intent", "")).strip(),
                action_summary=str(activity_dict.get("action_summary", "")).strip(),
                action_detail=str(activity_dict.get("action_detail", "")).strip(),
                utterance=str(activity_dict.get("utterance", "")).strip(),
            )
        )
    return records


def _parse_planned_actions(entry: dict[str, object]) -> list[PlannedActionRecord]:
    plan = entry.get("plan")
    if not isinstance(plan, dict):
        return []
    plan_dict = cast(dict[str, object], plan)
    action_catalog = plan_dict.get("action_catalog")
    if not isinstance(action_catalog, dict):
        return []
    action_catalog_dict = cast(dict[str, object], action_catalog)
    raw_actions = action_catalog_dict.get("actions", [])
    if not isinstance(raw_actions, list):
        return []

    results: list[PlannedActionRecord] = []
    for raw_action in raw_actions:
        if not isinstance(raw_action, dict):
            continue
        action_dict = cast(dict[str, object], raw_action)
        action_type = str(action_dict.get("action_type", "")).strip()
        if not action_type:
            continue
        results.append(
            PlannedActionRecord(
                action_type=action_type,
                label=str(action_dict.get("label", "")).strip(),
                description=str(action_dict.get("description", "")).strip(),
                supported_visibility=_string_list(
                    action_dict.get("supported_visibility", [])
                ),
                requires_target=bool(action_dict.get("requires_target", False)),
                supports_utterance=bool(action_dict.get("supports_utterance", False)),
            )
        )
    return results


def _parse_planned_max_rounds(entry: dict[str, object]) -> int:
    plan = entry.get("plan")
    if not isinstance(plan, dict):
        return 0
    plan_dict = cast(dict[str, object], plan)
    progression_plan = plan_dict.get("progression_plan")
    if not isinstance(progression_plan, dict):
        return 0
    progression_plan_dict = cast(dict[str, object], progression_plan)
    return _int_value(progression_plan_dict.get("max_rounds", 0))


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    results: list[str] = []
    for item in value:
        text = str(item).strip()
        if text:
            results.append(text)
    return results


def _int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


def _optional_int_value(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _float_value(value: object, default: float) -> float:
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return default


def _optional_float_value(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None
