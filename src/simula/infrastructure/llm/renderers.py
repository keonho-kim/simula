"""목적:
- 구조화 LLM 응답을 사람이 읽기 좋은 로그 텍스트로 변환한다.

설명:
- schema별 핵심 정보를 뽑아 CLI에서 읽기 쉬운 요약 로그를 만든다.

사용한 설계 패턴:
- renderer 유틸 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.router
- simula.domain.contracts
"""

from __future__ import annotations

import json

from pydantic import BaseModel

from simula.domain.contracts import (
    ActionCatalog,
    ActorFacingScenarioDigest,
    ActorActionProposal,
    ActorCard,
    ActorIntentStateBatch,
    BackgroundUpdateBatch,
    CastRoster,
    CoordinationFrame,
    ObserverReport,
    ExecutionPlanBundle,
    FinalReportSections,
    PlanningAnalysis,
    RuntimeProgressionPlan,
    ScenarioTimeScope,
    SimulationClockSnapshot,
    RoundDirective,
    RoundResolution,
    RoundTimeAdvanceProposal,
    SituationBundle,
)
from simula.domain.time_units import duration_label


def render_structured_response(
    *,
    role: str,
    parsed: BaseModel | None,
    content: str,
    log_context: dict[str, object] | None,
) -> str:
    """구조화 응답을 사람이 읽기 좋은 로그 텍스트로 변환한다."""

    if parsed is None:
        if not content.strip():
            return _render_block(
                subject=f"{role} | empty response",
                body="content: ",
            )
        return _render_block(
            subject=f"{role} | unparsed response",
            body=f"content:\n{_indent_block(content.strip())}",
        )

    if isinstance(parsed, PlanningAnalysis):
        return _render_model_block(
            subject="planner | 계획 분석 정리",
            model=parsed,
        )

    if isinstance(parsed, ScenarioTimeScope):
        return _render_model_block(
            subject="planner | 시간 범위 해석",
            model=parsed,
        )

    if isinstance(parsed, RuntimeProgressionPlan):
        return _render_model_block(
            subject="planner | 실행 시간 진행 계획",
            model=parsed,
        )

    if isinstance(parsed, RoundTimeAdvanceProposal):
        payload = parsed.model_dump(mode="json")
        payload["elapsed_label"] = duration_label(
            time_unit=parsed.elapsed_unit,
            amount=parsed.elapsed_amount,
        )
        return _render_block(
            subject="coordinator | round 경과 시간",
            body=_render_mapping(payload),
        )

    if isinstance(parsed, SimulationClockSnapshot):
        return _render_model_block(
            subject="runtime | simulation clock",
            model=parsed,
        )

    if isinstance(parsed, SituationBundle):
        return _render_model_block(
            subject="planner | 상황 정리",
            model=parsed,
        )

    if isinstance(parsed, ExecutionPlanBundle):
        return _render_model_block(
            subject="planner | 실행 계획 번들",
            model=parsed,
        )

    if isinstance(parsed, CoordinationFrame):
        return _render_model_block(
            subject="planner | 조율 기준 프레임",
            model=parsed,
        )

    if isinstance(parsed, ActionCatalog):
        return _render_model_block(
            subject="planner | action catalog",
            model=parsed,
        )

    if isinstance(parsed, CastRoster):
        return _render_model_block(
            subject="planner | cast roster",
            model=parsed,
        )

    if isinstance(parsed, ActorCard):
        return _render_model_block(
            subject=f"{parsed.display_name} | 인물 카드",
            model=parsed,
        )

    if isinstance(parsed, RoundDirective):
        return _render_model_block(
            subject="coordinator | round 지시",
            model=parsed,
        )

    if isinstance(parsed, BackgroundUpdateBatch):
        return _render_model_block(
            subject="coordinator | 배경 상태 변화",
            model=parsed,
        )

    if isinstance(parsed, ActorActionProposal):
        actor_name = _actor_name(log_context)
        return _render_model_block(
            subject=f"{actor_name} | 행동 제안",
            model=parsed,
        )

    if isinstance(parsed, ActorIntentStateBatch):
        return _render_model_block(
            subject="coordinator | actor intent 상태",
            model=parsed,
        )

    if isinstance(parsed, ActorFacingScenarioDigest):
        return _render_model_block(
            subject="coordinator | actor-facing digest",
            model=parsed,
        )

    if isinstance(parsed, ObserverReport):
        payload = parsed.model_dump(mode="json")
        payload["elapsed_label"] = _elapsed_label(log_context, parsed.round_index)
        payload["momentum_label"] = _momentum_text(parsed.momentum)
        return _render_block(
            subject="observer | 관찰 요약",
            body=_render_mapping(payload),
        )

    if isinstance(parsed, RoundResolution):
        return _render_model_block(
            subject="coordinator | round 해소 결과",
            model=parsed,
        )

    if isinstance(parsed, FinalReportSections):
        return _render_model_block(
            subject="finalizer | 최종 보고서 번들",
            model=parsed,
        )

    if isinstance(parsed, BaseModel):
        return _render_model_block(
            subject=f"{role} | structured response",
            model=parsed,
        )
    return _render_block(
        subject=f"{role} | structured response",
        body="content: ",
    )


def render_text_response(
    *,
    role: str,
    content: str,
    log_context: dict[str, object] | None,
) -> str:
    """원문 LLM 응답을 사람이 읽기 좋은 로그 텍스트로 변환한다."""

    stripped = content.strip()
    scope = str(log_context.get("scope")) if log_context else ""
    if role == "planner" and scope == "interpretation-core":
        return _render_block(
            subject="planner | 시나리오 핵심 전제",
            body=f"content:\n{_indent_block(stripped)}",
        )
    if role == "planner" and scope == "cast_roster":
        return _render_block(
            subject="planner | cast roster 원문",
            body=f"content:\n{_indent_block(stripped)}",
        )
    if role == "fixer" and scope == "json-fix":
        return _render_block(
            subject="fixer | JSON 복구 결과",
            body=f"content:\n{_indent_block(stripped)}",
        )
    return _render_block(
        subject=f"{role} | text response",
        body=f"content:\n{_indent_block(stripped)}",
    )


def _actor_name(log_context: dict[str, object] | None) -> str:
    if not log_context:
        return "actor"
    display_name = log_context.get("actor_display_name")
    if display_name is not None:
        return str(display_name)
    cast_id = log_context.get("cast_id")
    if cast_id is not None:
        return str(cast_id)
    return "actor"


def _actor_thought(log_context: dict[str, object] | None) -> str:
    if not log_context:
        return ""
    thought = log_context.get("actor_thought")
    if thought is None:
        return ""
    return str(thought)


def _actor_talking_points(log_context: dict[str, object] | None) -> list[str]:
    if not log_context:
        return []
    value = log_context.get("actor_talking_points")
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _actor_recommended_tone(log_context: dict[str, object] | None) -> str:
    if not log_context:
        return ""
    tone = log_context.get("actor_recommended_tone")
    if tone is None:
        return ""
    return str(tone)


def _list_preview(value: object, *, limit: int) -> str:
    if not isinstance(value, list):
        return "-"
    items = [str(item) for item in value[:limit]]
    return ", ".join(items) if items else "-"


def _extract_ndjson_names(content: str) -> list[str]:
    names: list[str] = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        name_key = '"display_name":"'
        if name_key not in stripped:
            continue
        start = stripped.index(name_key) + len(name_key)
        end = stripped.find('"', start)
        if end != -1:
            names.append(stripped[start:end])
    return names


def _subject_particle(text: str) -> str:
    return "이" if _has_batchim(text) else "가"


def _visibility_label(visibility: str) -> str:
    labels = {
        "public": "공개 행동",
        "private": "비공개 행동",
        "group": "일부 공개 행동",
    }
    return labels.get(visibility, "행동")


def _momentum_text(momentum: str) -> str:
    labels = {
        "high": "빠름",
        "medium": "보통",
        "low": "느림",
    }
    return labels.get(momentum, momentum)


def _target_description(target_cast_ids: list[str]) -> str:
    if not target_cast_ids:
        return "전체 공개"
    return ", ".join(target_cast_ids)


def _render_model_block(*, subject: str, model: BaseModel) -> str:
    return _render_block(
        subject=subject,
        body=_render_mapping(model.model_dump(mode="json")),
    )


def _render_block(*, subject: str, body: str) -> str:
    outer = "=" * 56
    inner = "-" * 56
    return "\n".join(
        [
            outer,
            subject,
            inner,
            body,
            inner,
            outer,
        ]
    )


def _render_mapping(mapping: dict[str, object]) -> str:
    lines: list[str] = []
    for key, value in mapping.items():
        lines.extend(_render_field_lines(key, value))
    return "\n".join(lines) if lines else "(empty)"


def _render_field_lines(key: str, value: object) -> list[str]:
    if isinstance(value, str):
        if "\n" not in value:
            return [f"{key}: {value}"]
        return [f"{key}:", _indent_block(value)]

    if isinstance(value, (dict, list)):
        return [
            f"{key}:",
            _indent_block(json.dumps(value, ensure_ascii=False, indent=2)),
        ]

    if isinstance(value, bool):
        return [f"{key}: {'true' if value else 'false'}"]

    if value is None:
        return [f"{key}: null"]

    return [f"{key}: {value}"]


def _indent_block(text: str) -> str:
    lines = text.splitlines() or [text]
    return "\n".join(f"  {line}" for line in lines)


def _has_batchim(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    last_char = stripped[-1]
    code = ord(last_char)
    if not (0xAC00 <= code <= 0xD7A3):
        return False
    return (code - 0xAC00) % 28 != 0


def _elapsed_label(log_context: dict[str, object] | None, round_index: int) -> str:
    if not log_context:
        return f"{round_index}단계"
    simulation_clock_label = log_context.get("simulation_clock_label")
    if isinstance(simulation_clock_label, str) and simulation_clock_label.strip():
        return simulation_clock_label
    return f"{round_index}단계"
