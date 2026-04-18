"""Purpose:
- Attribute fixer calls back to original roles and summarize retries.
"""

from __future__ import annotations

import re
from collections.abc import Iterable

from simula.application.analysis.metrics.distributions import summarize_numeric_values
from simula.application.analysis.models import (
    FixerAttemptRecord,
    FixerReport,
    FixerRoleSummary,
    FixerSessionRecord,
    LLMCallRecord,
)

_TARGET_SCHEMA_PATTERN = re.compile(
    r"^Target schema:\s*(?P<schema>[A-Za-z0-9_]+)\s*$",
    re.MULTILINE,
)

_SCHEMA_ROLE_MAP = {
    "PlanningAnalysis": "planner",
    "ExecutionPlanBundle": "planner",
    "GeneratedActorCardDraft": "generator",
    "RoundDirective": "coordinator",
    "RoundResolution": "coordinator",
    "ActorActionProposal": "actor",
    "TimelineAnchorDecision": "observer",
}


def build_fixer_report(llm_calls: list[LLMCallRecord]) -> FixerReport:
    """Build role-attributed fixer metrics and retry sessions."""

    attempts = [_build_attempt(call) for call in llm_calls if call.role == "fixer"]
    sessions = _group_sessions(attempts)
    roles = sorted({attempt.attributed_role for attempt in attempts})
    by_role = {
        role: _build_role_summary(
            role=role,
            attempts=[attempt for attempt in attempts if attempt.attributed_role == role],
            sessions=[session for session in sessions if session.attributed_role == role],
        )
        for role in roles
    }
    return FixerReport(
        attempts=attempts,
        sessions=sessions,
        overall=_build_role_summary(role="overall", attempts=attempts, sessions=sessions),
        by_role=by_role,
    )


def _build_attempt(call: LLMCallRecord) -> FixerAttemptRecord:
    schema_name = call.fixer_schema_name or _extract_schema_name(call.prompt)
    return FixerAttemptRecord(
        sequence=call.sequence,
        attempt=_attempt_number(call),
        attributed_role=_SCHEMA_ROLE_MAP.get(schema_name, "unknown"),
        schema_name=schema_name,
        ttft_seconds=call.ttft_seconds,
        duration_seconds=call.duration_seconds,
        input_tokens=call.input_tokens,
        output_tokens=call.output_tokens,
        total_tokens=call.total_tokens,
    )


def _attempt_number(call: LLMCallRecord) -> int:
    raw_attempt = call.log_context.get("attempt")
    try:
        attempt = int(str(raw_attempt))
    except (TypeError, ValueError):
        return 1
    return max(1, attempt)


def _extract_schema_name(prompt: str) -> str:
    match = _TARGET_SCHEMA_PATTERN.search(prompt)
    if match is None:
        return "unknown"
    schema_name = match.group("schema").strip()
    return schema_name or "unknown"


def _group_sessions(attempts: list[FixerAttemptRecord]) -> list[FixerSessionRecord]:
    if not attempts:
        return []

    sessions: list[list[FixerAttemptRecord]] = []
    current: list[FixerAttemptRecord] = []
    for attempt in attempts:
        should_start_new = (
            not current
            or attempt.attempt == 1
            or current[-1].attributed_role != attempt.attributed_role
            or current[-1].schema_name != attempt.schema_name
        )
        if should_start_new:
            if current:
                sessions.append(current)
            current = [attempt]
            continue
        current.append(attempt)
    if current:
        sessions.append(current)

    grouped: list[FixerSessionRecord] = []
    for index, items in enumerate(sessions, start=1):
        grouped.append(
            FixerSessionRecord(
                session_index=index,
                attributed_role=items[0].attributed_role,
                schema_name=items[0].schema_name,
                attempt_count=len(items),
                retry_count=sum(1 for item in items if item.attempt > 1),
                first_sequence=items[0].sequence,
                last_sequence=items[-1].sequence,
                ttft_seconds=next(
                    (item.ttft_seconds for item in items if item.ttft_seconds is not None),
                    None,
                ),
                duration_seconds=sum(item.duration_seconds for item in items),
                input_tokens=_sum_optional_int(item.input_tokens for item in items),
                output_tokens=_sum_optional_int(item.output_tokens for item in items),
                total_tokens=_sum_optional_int(item.total_tokens for item in items),
            )
        )
    return grouped


def _build_role_summary(
    *,
    role: str,
    attempts: list[FixerAttemptRecord],
    sessions: list[FixerSessionRecord],
) -> FixerRoleSummary:
    return FixerRoleSummary(
        role=role,
        fixer_call_count=len(attempts),
        session_count=len(sessions),
        retry_count=sum(session.retry_count for session in sessions),
        ttft=summarize_numeric_values(
            [item.ttft_seconds for item in attempts if item.ttft_seconds is not None]
        ),
        duration=summarize_numeric_values(
            [item.duration_seconds for item in attempts]
        ),
    )


def _sum_optional_int(values: Iterable[int | None]) -> int | None:
    present = [value for value in values if value is not None]
    if not present:
        return None
    return sum(int(value) for value in present)
