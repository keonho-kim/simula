"""목적:
- machine-readable LLM 응답을 사람이 읽기 좋은 로그 텍스트로 변환한다.

설명:
- schema별 핵심 정보를 뽑아 CLI에서 읽기 쉬운 요약 로그를 만든다.

사용한 설계 패턴:
- renderer 유틸 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.runtime.router
- simula.domain.contracts
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import cast

from pydantic import BaseModel

from simula.domain.contracts import (
    ActionCatalog,
    ActorFacingScenarioDigest,
    ActorActionProposal,
    ActorCard,
    CastRoster,
    CoordinationFrame,
    ObserverReport,
    ExecutionPlanBundle,
    PlanningAnalysis,
    RuntimeProgressionPlan,
    ScenarioTimeScope,
    SimulationClockSnapshot,
    RoundDirective,
    RoundResolution,
    RoundTimeAdvanceProposal,
    SituationBundle,
)
from simula.domain.scenario.time import duration_label


def render_object_response(
    *,
    role: str,
    parsed: BaseModel | None,
    content: str,
    log_context: dict[str, object] | None,
) -> str:
    """Object 응답을 사람이 읽기 좋은 로그 텍스트로 변환한다."""

    if parsed is None:
        if not content.strip():
            return _render_block(
                subject=f"{role} | 빈 응답",
                body="content: ",
            )
        return _render_block(
            subject=f"{role} | RAW RESPONSE",
            body=f"content:\n{_indent_block(content.strip())}",
        )

    if isinstance(parsed, PlanningAnalysis):
        return _render_model_block(
            subject="planner | 계획 분석 정리",
            model=parsed,
        )

    if isinstance(parsed, ScenarioTimeScope):
        return _render_model_block(
            subject="planner | 시나리오 시간 단위",
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
            subject="coordinator | ROUND 경과 시간",
            body=_render_mapping(payload),
        )

    if isinstance(parsed, SimulationClockSnapshot):
        return _render_model_block(
            subject="runtime | 시뮬레이션 시간 스냅샷",
            model=parsed,
        )

    if isinstance(parsed, SituationBundle):
        return _render_model_block(
            subject="planner | 상황 정리",
            model=parsed,
        )

    if isinstance(parsed, ExecutionPlanBundle):
        return _render_model_block(
            subject="planner | 실행 계획",
            model=parsed,
        )

    if isinstance(parsed, CoordinationFrame):
        return _render_model_block(
            subject="planner | 상황 조율 기준",
            model=parsed,
        )

    if isinstance(parsed, ActionCatalog):
        return _render_model_block(
            subject="planner | ACTION CATALOG",
            model=parsed,
        )

    if isinstance(parsed, CastRoster):
        return _render_model_block(
            subject="planner | CAST ROASTER",
            model=parsed,
        )

    if isinstance(parsed, ActorCard):
        return _render_model_block(
            subject=f"{parsed.display_name} | 인물 카드",
            model=parsed,
        )

    if isinstance(parsed, RoundDirective):
        return _render_model_block(
            subject="coordinator | ROUND 가이드 ",
            model=parsed,
        )

    if isinstance(parsed, ActorActionProposal):
        actor_name = _actor_name(log_context)
        return _render_model_block(
            subject=f"{actor_name} | 행동 제안",
            model=parsed,
        )

    if isinstance(parsed, ActorFacingScenarioDigest):
        return _render_model_block(
            subject="coordinator | 등장인물 상황 전파",
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
            subject="coordinator | ROUND 결과",
            model=parsed,
        )

    if isinstance(parsed, BaseModel):
        return _render_model_block(
            subject=f"{role} | STRUCTURED",
            model=parsed,
        )
    return _render_block(
        subject=f"{role} | OBJECT",
        body="content: ",
    )


def render_simple_response(
    *,
    role: str,
    parsed: object | None,
    content: str,
    output_type_name: str,
    log_context: dict[str, object] | None,
) -> str:
    """Simple 응답을 사람이 읽기 좋은 로그 텍스트로 변환한다."""

    if parsed is None:
        stripped = content.strip()
        if not stripped:
            return _render_block(
                subject=f"{role} | SIMPLE {output_type_name}",
                body="content: ",
            )
        return _render_block(
            subject=f"{role} | SIMPLE {output_type_name}",
            body=f"content:\n{_indent_block(stripped)}",
        )
    return _render_block(
        subject=f"{role} | SIMPLE {output_type_name}",
        body=_render_simple_value(parsed),
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
            subject="planner | 시나리오 핵심",
            body=f"content:\n{_indent_block(stripped)}",
        )
    if role == "planner" and scope == "cast_roster":
        return _render_block(
            subject="planner | CAST ROASTER",
            body=f"content:\n{_indent_block(stripped)}",
        )
    if role == "fixer" and scope == "json-fix":
        return _render_block(
            subject="fixer | JSON 복구 결과",
            body=f"content:\n{_indent_block(stripped)}",
        )
    return _render_block(
        subject=f"{role} | TEXT RESPONSE",
        body=f"content:\n{_indent_block(stripped)}",
    )


def _render_simple_value(value: object) -> str:
    if isinstance(value, BaseModel):
        return _render_mapping(value.model_dump(mode="json"))
    if isinstance(value, list):
        rendered = [
            item.model_dump(mode="json") if isinstance(item, BaseModel) else item
            for item in value
        ]
        return _indent_block(json.dumps(rendered, ensure_ascii=False, indent=2))
    if isinstance(value, Mapping):
        return _render_mapping(dict(cast(Mapping[str, object], value)))
    return _indent_block(json.dumps(value, ensure_ascii=False, indent=2))


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
        "public": "공개 상황 행동",
        "private": "사적 상황 행동",
        "group": "그룹 내 행동",
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
    if _is_empty_value(value):
        return [f"{key}: {_render_empty_value(key, value)}"]
    return (
        [f"{key}: {_format_scalar(value)}"]
        if _is_scalar(value)
        else [
            f"{key}:",
            *_render_nested(value, indent=4, parent_key=key),
        ]
    )


def _indent_block(text: str) -> str:
    lines = text.splitlines() or [text]
    return "\n".join(f"  {line}" for line in lines)


def _render_nested(
    value: object,
    *,
    indent: int,
    parent_key: str | None = None,
) -> list[str]:
    prefix = " " * indent

    if isinstance(value, dict):
        lines: list[str] = []
        for raw_key, item in value.items():
            key = str(raw_key)
            if _is_empty_value(item):
                lines.append(f"{prefix}{key}: {_render_empty_value(key, item)}")
                continue
            if _is_scalar(item):
                lines.append(f"{prefix}{key}: {_format_scalar(item)}")
                continue
            lines.append(f"{prefix}{key}:")
            lines.extend(_render_nested(item, indent=indent + 4, parent_key=key))
        if lines:
            return lines
        return [f"{prefix}{_render_empty_value(parent_key, value)}"]

    if isinstance(value, list):
        if not value:
            return [f"{prefix}{_render_empty_value(parent_key, value)}"]
        lines: list[str] = []
        for item in value:
            if _is_empty_value(item):
                lines.append(f"{prefix}- {_render_empty_value(None, item)}")
                continue
            if _is_scalar(item):
                lines.append(f"{prefix}- {_format_scalar(item)}")
                continue
            if isinstance(item, dict):
                lines.extend(
                    _render_dict_list_item(
                        cast(Mapping[object, object], item),
                        indent=indent,
                    )
                )
                continue
            lines.append(f"{prefix}-")
            lines.extend(_render_nested(item, indent=indent + 4))
        if lines:
            return lines
        return [f"{prefix}{_render_empty_value(parent_key, value)}"]

    return [f"{prefix}{_format_scalar(value)}"]


def _is_scalar(value: object) -> bool:
    return not isinstance(value, (dict, list))


def _format_scalar(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    return str(value)


def _is_empty_value(value: object) -> bool:
    if isinstance(value, str):
        return value == ""
    if isinstance(value, (dict, list)):
        return len(value) == 0
    return False


def _render_empty_value(key: str | None, value: object) -> str:
    if key == "stop_reason" and value == "":
        return "continue"
    return "empty"


def _render_dict_list_item(item: Mapping[object, object], *, indent: int) -> list[str]:
    prefix = " " * indent
    nested_prefix = indent + 4
    entries = [(str(raw_key), value) for raw_key, value in item.items()]
    if not entries:
        return [f"{prefix}- empty"]

    first_key, first_value = entries[0]
    lines: list[str] = []
    if _is_empty_value(first_value):
        lines.append(
            f"{prefix}- {first_key}: {_render_empty_value(first_key, first_value)}"
        )
    elif _is_scalar(first_value):
        lines.append(f"{prefix}- {first_key}: {_format_scalar(first_value)}")
    else:
        lines.append(f"{prefix}- {first_key}:")
        lines.extend(
            _render_nested(first_value, indent=nested_prefix + 4, parent_key=first_key)
        )

    for key, value in entries[1:]:
        if _is_empty_value(value):
            lines.append(
                f"{' ' * nested_prefix}{key}: {_render_empty_value(key, value)}"
            )
            continue
        if _is_scalar(value):
            lines.append(f"{' ' * nested_prefix}{key}: {_format_scalar(value)}")
            continue
        lines.append(f"{' ' * nested_prefix}{key}:")
        lines.extend(_render_nested(value, indent=nested_prefix + 4, parent_key=key))
    return lines


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
