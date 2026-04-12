"""목적:
- 최종 보고서 타임라인의 시작 시각을 결정한다.

설명:
- 시나리오에서 절대 날짜/시각을 파싱하고, 부족하면 LLM으로 보완한다.

사용한 설계 패턴:
- hybrid parser + structured inference 패턴
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization.prompts.timeline_anchor_prompt import (
    PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import TimelineAnchorDecision
from simula.prompts.shared.output_examples import build_output_prompt_bundle

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


async def resolve_timeline_anchor(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """타임라인 시작 시각을 결정한다."""

    explicit_anchor = extract_explicit_anchor(str(state["scenario"]))
    if explicit_anchor is not None:
        payload = TimelineAnchorDecision(
            anchor_iso=explicit_anchor.isoformat(timespec="seconds"),
            selection_reason="시나리오 본문에 절대 날짜와 시각이 명시되어 있어 이를 그대로 시작 anchor로 사용했다.",
        )
        return {"report_timeline_anchor_json": payload.model_dump(mode="json")}

    partial_hint = extract_partial_anchor_hint(str(state["scenario"]))
    prompt = PROMPT.format(
        scenario_text=state["scenario"],
        date_hint=partial_hint["date_hint"],
        time_hint=partial_hint["time_hint"],
        context_hint=partial_hint["context_hint"],
        elapsed_simulation_label=str(
            _dict_value(state.get("simulation_clock", {})).get(
                "total_elapsed_label",
                "0분",
            )
        ),
        max_steps=state["max_steps"],
        **build_output_prompt_bundle(TimelineAnchorDecision),
    )
    anchor, _ = await runtime.context.llms.ainvoke_structured_with_meta(
        "observer",
        prompt,
        TimelineAnchorDecision,
        log_context={"scope": "final-report", "section": "timeline-anchor"},
    )
    parsed_anchor = datetime.fromisoformat(anchor.anchor_iso)
    normalized = anchor.model_copy(
        update={"anchor_iso": parsed_anchor.isoformat(timespec="seconds")}
    )
    return {"report_timeline_anchor_json": normalized.model_dump(mode="json")}


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


def _dict_value(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return cast(dict[str, object], value)
