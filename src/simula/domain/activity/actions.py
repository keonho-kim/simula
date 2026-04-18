"""목적:
- canonical action 생성과 조회 규칙을 제공한다.

설명:
- action 식별자, 생성 시각, 최근 액션 조회를 실행 계층 밖으로 분리한다.

사용한 설계 패턴:
- 순수 팩토리 함수 패턴

연관된 다른 모듈/구조:
- simula.domain.contracts
- simula.application.workflow.graphs.runtime.nodes
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from simula.domain.contracts import CanonicalAction, VisibilityType


def new_action_id() -> str:
    """액션 식별자를 생성한다."""

    return f"act-{uuid4().hex[:12]}"


def iso_timestamp() -> str:
    """UTC ISO 타임스탬프를 생성한다."""

    return datetime.now(timezone.utc).isoformat()


def create_canonical_action(
    *,
    run_id: str,
    round_index: int,
    source_cast_id: str,
    visibility: VisibilityType,
    target_cast_ids: list[str],
    visibility_scope: list[str],
    action_type: str,
    goal: str,
    summary: str,
    detail: str,
    utterance: str = "",
    thread_id: str = "",
) -> CanonicalAction:
    """canonical action을 생성한다."""

    return CanonicalAction(
        activity_id=new_action_id(),
        run_id=run_id,
        round_index=round_index,
        source_cast_id=source_cast_id,
        visibility=visibility,
        target_cast_ids=target_cast_ids,
        visibility_scope=visibility_scope,
        action_type=action_type,
        goal=goal,
        summary=summary,
        detail=detail,
        utterance=utterance,
        thread_id=thread_id,
        created_at=iso_timestamp(),
    )


def recent_actions(
    actions: list[dict[str, object]],
    *,
    limit: int = 5,
) -> list[dict[str, object]]:
    """최근 action 최대 limit개를 반환한다."""

    return list(actions[-limit:])
