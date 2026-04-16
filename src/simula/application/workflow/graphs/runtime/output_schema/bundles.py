"""목적:
- runtime 그래프 전용 출력 schema 예시 묶음을 제공한다.

설명:
- actor proposal과 observer report 단계에서 필요한 예시만 로컬에 둔다.

사용한 설계 패턴:
- graph-local prompt asset 패턴
"""

from __future__ import annotations

from typing import Any

from simula.prompts.shared.output_schema_utils import (
    ExampleMode,
    build_json_prompt_bundle,
)


def build_actor_action_proposal_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_ACTOR_ACTION_PROPOSAL_EXAMPLE,
        example_mode=example_mode,
    )


def build_observer_report_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_OBSERVER_REPORT_EXAMPLE,
        example_mode=example_mode,
    )


_ACTOR_ACTION_PROPOSAL_EXAMPLE: dict[str, Any] = {
    "action_type": "<choose one action_type from runtime_guidance.available_actions>",
    "intent": "<one Korean sentence describing the intended change>",
    "intent_target_cast_ids": ["<cast_id string or an empty list>"],
    "action_summary": "<one Korean sentence summarizing the action>",
    "action_detail": "<one Korean sentence describing the concrete action in more detail>",
    "utterance": "<one Korean spoken line or an empty string>",
    "visibility": "<choose exactly one of public, private, group>",
    "target_cast_ids": ["<real visible other cast_id values, or an empty list for solo private/public actions>"],
    "thread_id": "<stable thread identifier or an empty string>",
}

_OBSERVER_REPORT_EXAMPLE: dict[str, Any] = {
    "round_index": "<copy the current round index as an integer>",
    "summary": "<one Korean sentence summarizing the round outcome>",
    "notable_events": ["<one notable event from this round>"],
    "atmosphere": "<short Korean atmosphere label>",
    "momentum": "<choose exactly one of high, medium, low>",
    "world_state_summary": "<one Korean sentence describing the updated world state>",
}
