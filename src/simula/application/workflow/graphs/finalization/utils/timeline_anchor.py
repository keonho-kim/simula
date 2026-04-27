"""Timeline anchor parsing helpers."""

from __future__ import annotations

import re
from datetime import datetime

_DATE_PATTERNS = [
    re.compile(r"(?P<year>\d{4})년\s*(?P<month>\d{1,2})월\s*(?P<day>\d{1,2})일"),
    re.compile(r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})"),
]
_TIME_PATTERNS = [
    re.compile(r"(?P<hour>\d{1,2}):(?P<minute>\d{2})"),
    re.compile(
        r"(?P<period>오전|오후|밤)\s*(?P<hour>\d{1,2})시(?:\s*(?P<minute>\d{1,2})분)?"
    ),
]


def extract_explicit_anchor(scenario_text: str) -> datetime | None:
    """시나리오에서 절대 날짜와 시각을 직접 파싱한다."""

    date_match = _find_first_date(scenario_text)
    time_match = _find_first_time(scenario_text)
    if date_match is None or time_match is None:
        return None

    year, month, day = date_match
    hour, minute = time_match
    return datetime(year, month, day, hour, minute)


def extract_partial_anchor_hint(scenario_text: str) -> dict[str, str]:
    """LLM 보완용 날짜/시각 힌트를 추출한다."""

    date_match = _find_first_date(scenario_text)
    time_match = _find_first_time(scenario_text)
    context_hint = _find_context_hint(scenario_text)

    if date_match is None:
        date_hint = "없음"
    else:
        date_hint = f"{date_match[0]:04d}-{date_match[1]:02d}-{date_match[2]:02d}"

    if time_match is None:
        time_hint = "없음"
    else:
        time_hint = f"{time_match[0]:02d}:{time_match[1]:02d}"

    return {
        "date_hint": date_hint,
        "time_hint": time_hint,
        "context_hint": context_hint,
    }


def _find_first_date(scenario_text: str) -> tuple[int, int, int] | None:
    for pattern in _DATE_PATTERNS:
        match = pattern.search(scenario_text)
        if match is None:
            continue
        return (
            int(match.group("year")),
            int(match.group("month")),
            int(match.group("day")),
        )
    return None


def _find_first_time(scenario_text: str) -> tuple[int, int] | None:
    for pattern in _TIME_PATTERNS:
        match = pattern.search(scenario_text)
        if match is None:
            continue
        period = match.groupdict().get("period")
        hour = int(match.group("hour"))
        minute = int(match.groupdict().get("minute") or 0)
        if period == "오후" and hour < 12:
            hour += 12
        if period == "오전" and hour == 12:
            hour = 0
        if period == "밤" and hour < 12:
            hour += 12
        return hour, minute
    return None


def _find_context_hint(scenario_text: str) -> str:
    for line in scenario_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("- ") and any(
            keyword in stripped for keyword in ("오전", "오후", "밤", "새벽")
        ):
            return stripped
    for line in scenario_text.splitlines():
        stripped = line.strip()
        if any(keyword in stripped for keyword in ("시점", "시작 시점", "시작 시각")):
            return stripped
    return "없음"
