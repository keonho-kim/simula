"""목적:
- actor 식별자 정규화와 unique cast 검증 규칙을 제공한다.

설명:
- 생성된 actor 목록의 빈 id 보정과 cast/display name 중복 검증 규칙을 한 곳에서 관리한다.

사용한 설계 패턴:
- 순수 정규화 함수 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.generation.nodes.finalize
"""

from __future__ import annotations

import re


def finalize_actor_registry(actors: list[dict[str, object]]) -> list[dict[str, object]]:
    """actor id를 보정하고 cast/display 중복을 검증한다."""

    normalized: list[dict[str, object]] = []
    seen_actor_ids: set[str] = set()
    seen_cast_ids: set[str] = set()
    seen_display_names: set[str] = set()

    for index, actor in enumerate(actors, start=1):
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

        candidate = slugify_text(str(actor.get("actor_id") or display_name))
        if not candidate:
            candidate = f"actor-{index}"
        if candidate in seen_actor_ids:
            raise ValueError(f"중복 actor_id를 허용하지 않습니다: {candidate}")

        updated = dict(actor)
        updated["actor_id"] = candidate
        normalized.append(updated)
        seen_actor_ids.add(candidate)
        seen_cast_ids.add(cast_id)
        seen_display_names.add(display_name)

    return normalized


def slugify_text(value: str) -> str:
    """사람 이름이나 라벨을 actor id 후보로 바꾼다."""

    lowered = value.strip().lower()
    cleaned = re.sub(r"[^0-9a-z가-힣]+", "-", lowered)
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    return cleaned
