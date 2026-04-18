"""Prompt and logging helpers for actor turns."""

from __future__ import annotations

import json
from typing import Any, cast

from simula.shared.logging.llm import build_llm_log_context
from simula.application.workflow.graphs.runtime.output_schema.bundles import (
    build_actor_action_narrative_prompt_bundle,
    build_actor_action_shell_prompt_bundle,
)
from simula.application.workflow.graphs.runtime.prompts.actor_action_narrative_prompt import (
    PROMPT as ACTOR_ACTION_NARRATIVE_PROMPT,
)
from simula.application.workflow.graphs.runtime.prompts.actor_action_shell_prompt import (
    PROMPT as ACTOR_ACTION_SHELL_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import ActorActionShell


def build_actor_action_shell_prompt(
    *,
    state: SimulationWorkflowState,
    actor: dict[str, Any],
    focus_slice: dict[str, object],
    visible_action_context: list[dict[str, object]],
    unread_backlog_digest: object,
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
    max_recipients_per_message: int,
) -> str:
    available_actions = cast(list[object], runtime_guidance.get("available_actions", []))
    compact_action_table: list[dict[str, object]] = []
    for raw_item in available_actions:
        if not isinstance(raw_item, dict):
            continue
        item = cast(dict[str, object], raw_item)
        supported_visibility = item.get("supported_visibility", [])
        compact_action_table.append(
            {
                "action_type": str(item.get("action_type", "")),
                "supported_visibility": list(supported_visibility)
                if isinstance(supported_visibility, list)
                else [],
                "requires_target": bool(item.get("requires_target", False)),
            }
        )
    valid_visible_target_ids = [
        str(item.get("cast_id", ""))
        for item in visible_actors
        if str(item.get("cast_id", "")).strip()
        and str(item.get("cast_id", "")).strip() != str(actor.get("cast_id", ""))
    ]
    return ACTOR_ACTION_SHELL_PROMPT.format(
        round_index=state["round_index"],
        actor_json=json.dumps(actor, ensure_ascii=False, separators=(",", ":")),
        focus_slice_json=json.dumps(
            focus_slice if isinstance(focus_slice, dict) else {},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        visible_action_context_json=json.dumps(
            visible_action_context,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        visible_actors_json=json.dumps(
            visible_actors,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        unread_backlog_digest_json=json.dumps(
            unread_backlog_digest,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        runtime_guidance_json=json.dumps(
            runtime_guidance,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        action_policy_table_json=json.dumps(
            compact_action_table,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        valid_visible_target_ids_json=json.dumps(
            valid_visible_target_ids,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        max_recipients_per_message=max_recipients_per_message,
        **build_actor_action_shell_prompt_bundle(),
    )


def build_actor_action_narrative_prompt(
    *,
    state: SimulationWorkflowState,
    actor: dict[str, Any],
    focus_slice: dict[str, object],
    visible_action_context: list[dict[str, object]],
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
    shell: ActorActionShell,
    selected_action_spec: dict[str, object],
) -> str:
    return ACTOR_ACTION_NARRATIVE_PROMPT.format(
        round_index=state["round_index"],
        actor_json=json.dumps(actor, ensure_ascii=False, separators=(",", ":")),
        selected_action_shell_json=json.dumps(
            shell.model_dump(mode="json"),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        selected_action_spec_json=json.dumps(
            selected_action_spec,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        focus_slice_json=json.dumps(
            focus_slice if isinstance(focus_slice, dict) else {},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        visible_action_context_json=json.dumps(
            visible_action_context,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        visible_actors_json=json.dumps(
            visible_actors,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        runtime_guidance_json=json.dumps(
            runtime_guidance,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **build_actor_action_narrative_prompt_bundle(),
    )


def actor_log_context(
    state: SimulationWorkflowState,
    actor: dict[str, Any],
    *,
    task_key: str,
    schema: type[object],
    action_type: str = "",
) -> dict[str, object]:
    runtime_guidance = state.get("actor_proposal_task", {}).get("runtime_guidance", {})
    digest = cast(
        dict[str, object],
        runtime_guidance.get("actor_facing_scenario_digest", {}),
    )
    return build_llm_log_context(
        scope="actor-turn",
        phase="runtime",
        task_key=task_key,
        task_label="행동 제안",
        artifact_key="pending_actor_proposals",
        artifact_label="pending_actor_proposals",
        schema=cast(type[Any], schema),
        round_index=int(state["round_index"]),
        simulation_clock_label=str(
            cast(dict[str, object], state.get("simulation_clock", {})).get(
                "total_elapsed_label",
                "0분",
            )
        ),
        cast_id=str(actor["cast_id"]),
        actor_display_name=actor.get("display_name"),
        action_type=action_type,
        actor_next_step_notes=digest.get("next_step_notes", []),
    )


def log_actor_proposal_completed(
    *,
    logger: Any,
    round_index: int,
    actor: dict[str, Any],
    proposal: object,
    forced_default: bool,
    duration_seconds: float,
) -> None:
    actor_name = str(actor.get("display_name") or actor.get("cast_id") or "actor")
    status = "대기 적용" if forced_default else str(getattr(proposal, "action_type", ""))
    visibility = visibility_label(str(getattr(proposal, "visibility", "")))
    target_cast_ids = list(getattr(proposal, "target_cast_ids", []))
    utterance = str(getattr(proposal, "utterance", "") or "").strip()
    logger.info(
        "%s | %s | %s | 대상 %s\n목표: %s\n행동: %s\n세부: %s\n발언: %s\n소요: %.2fs | round %s",
        actor_name,
        status,
        visibility,
        target_preview(target_cast_ids),
        field_text(getattr(proposal, "goal", "")),
        field_text(getattr(proposal, "summary", "")),
        field_text(getattr(proposal, "detail", "")),
        utterance or "발언 없음",
        duration_seconds,
        round_index,
    )


def target_preview(target_cast_ids: list[str]) -> str:
    if not target_cast_ids:
        return "없음"
    if len(target_cast_ids) <= 3:
        return ", ".join(target_cast_ids)
    head = ", ".join(target_cast_ids[:3])
    return f"{head} 외 {len(target_cast_ids) - 3}명"


def visibility_label(visibility: str) -> str:
    labels = {
        "public": "공개",
        "private": "비공개",
        "group": "그룹 공개",
    }
    return labels.get(visibility, "action")


def truncate_text(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def field_text(value: object) -> str:
    text = str(value or "").strip()
    return text if text else "-"


def int_value(value: object, *, default: int) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            return int(stripped)
    return default
