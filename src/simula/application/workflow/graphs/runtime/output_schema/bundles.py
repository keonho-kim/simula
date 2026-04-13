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
    "action_type": "speech",
    "intent": "상대가 우선순위를 다시 보게 만든다.",
    "intent_target_actor_ids": ["finance-director"],
    "action_summary": "운영 총괄이 비공개로 재검토를 요청한다.",
    "action_detail": "운영 총괄은 바로 결정하지 말고 일정 리스크를 다시 확인하자고 조용히 압박한다.",
    "utterance": "지금 바로 확정하지 말고 일정 리스크부터 다시 보죠.",
    "visibility": "private",
    "target_actor_ids": ["finance-director"],
    "thread_id": "ops-private-thread",
}

_OBSERVER_REPORT_EXAMPLE: dict[str, Any] = {
    "round_index": 1,
    "summary": "직접 action이 먼저 쌓이며 다음 round 선택 압력이 커졌다.",
    "notable_events": [
        "운영 총괄이 재검토를 제안했다.",
        "핵심 실무자들이 같은 방향으로 움직였다.",
    ],
    "atmosphere": "경계",
    "momentum": "medium",
    "world_state_summary": "직접 조정 action이 누적되며 다음 round 선택 방향이 갈리기 시작했다.",
}
