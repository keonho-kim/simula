"""목적:
- actor registry 일관성 검증 규칙을 제공한다.

설명:
- 생성된 actor 목록의 cast/display 중복과 필수 identity 정합성을 한 곳에서 검증한다.

사용한 설계 패턴:
- 순수 검증 함수 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.generation.nodes.finalize_actor_roster
"""

from __future__ import annotations


def finalize_actor_registry(actors: list[dict[str, object]]) -> list[dict[str, object]]:
    """actor registry의 identity를 검증하고 입력 순서를 유지한다."""

    normalized: list[dict[str, object]] = []
    seen_cast_ids: set[str] = set()
    seen_display_names: set[str] = set()

    for actor in actors:
        cast_id = str(actor.get("cast_id", "")).strip()
        if not cast_id:
            raise ValueError("모든 actor는 cast_id를 가져야 합니다.")
        if cast_id in seen_cast_ids:
            raise ValueError(f"중복 cast_id를 허용하지 않습니다: {cast_id}")

        display_name = str(actor.get("display_name", "")).strip()
        if not display_name:
            raise ValueError("모든 actor는 display_name을 가져야 합니다.")
        if display_name in seen_display_names:
            raise ValueError(f"중복 display_name을 허용하지 않습니다: {display_name}")

        normalized.append(dict(actor))
        seen_cast_ids.add(cast_id)
        seen_display_names.add(display_name)

    return normalized
