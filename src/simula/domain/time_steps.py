"""목적:
- 동적 시뮬레이션 시간 진행의 공용 단위와 라벨 규칙을 제공한다.

설명:
- planner, runtime, finalization이 같은 canonical 시간 표현을 사용하도록
  분 단위 정규화와 사람 친화 라벨 생성을 한 곳에 모은다.

사용한 설계 패턴:
- 순수 시간 정규화 유틸 패턴

연관된 다른 모듈/구조:
- simula.domain.contracts
- simula.application.workflow.graphs
- simula.infrastructure.llm.renderers
"""

from __future__ import annotations

from typing import Literal

TimeUnit = Literal["minute", "hour", "day", "week"]

_TIME_UNIT_LABELS: dict[TimeUnit, str] = {
    "minute": "분",
    "hour": "시간",
    "day": "일",
    "week": "주",
}

_MINUTES_PER_UNIT: dict[TimeUnit, int] = {
    "minute": 1,
    "hour": 60,
    "day": 60 * 24,
    "week": 60 * 24 * 7,
}


def duration_minutes(*, time_unit: TimeUnit, amount: int) -> int:
    """시간 단위와 양을 canonical 분 값으로 정규화한다."""

    if amount < 1:
        raise ValueError("시간 경과량은 1 이상이어야 합니다.")
    return amount * _MINUTES_PER_UNIT[time_unit]


def duration_label(*, time_unit: TimeUnit, amount: int) -> str:
    """한 번의 경과 시간을 사람이 읽는 라벨로 변환한다."""

    if amount < 1:
        raise ValueError("시간 경과량은 1 이상이어야 합니다.")
    return f"{amount}{_TIME_UNIT_LABELS[time_unit]}"


def cumulative_elapsed_label(total_elapsed_minutes: int) -> str:
    """누적 경과 시간을 사람이 읽는 라벨로 변환한다."""

    if total_elapsed_minutes < 0:
        raise ValueError("누적 경과 시간은 음수일 수 없습니다.")
    if total_elapsed_minutes == 0:
        return "0분"

    parts: list[str] = []
    remaining = total_elapsed_minutes
    for unit, unit_minutes in (
        ("week", _MINUTES_PER_UNIT["week"]),
        ("day", _MINUTES_PER_UNIT["day"]),
        ("hour", _MINUTES_PER_UNIT["hour"]),
        ("minute", _MINUTES_PER_UNIT["minute"]),
    ):
        amount, remaining = divmod(remaining, unit_minutes)
        if amount > 0:
            parts.append(f"{amount}{_TIME_UNIT_LABELS[unit]}")
    return " ".join(parts)
