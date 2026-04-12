"""목적:
- LangGraph workflow 병렬 fan-in 을 위한 reducer 함수를 제공한다.

설명:
- Send fan-out 결과를 안전하게 합치고, 필요한 경우 전체 값을 reset 할 수 있게 한다.

사용한 설계 패턴:
- reducer 함수 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.simulation.states.state
- simula.application.workflow.graphs.generation.graph
- simula.application.workflow.graphs.runtime.graph
"""

from __future__ import annotations

from typing import Any


def extend_list(
    left: list[dict[str, Any]] | None,
    right: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """dict list 채널을 이어 붙인다."""

    if left is None:
        return list(right or [])
    if right is None:
        return list(left)
    return list(left) + list(right)


def extend_str_list(left: list[str] | None, right: list[str] | None) -> list[str]:
    """문자열 리스트 채널을 이어 붙인다."""

    if left is None:
        return list(right or [])
    if right is None:
        return list(left)
    return list(left) + list(right)
