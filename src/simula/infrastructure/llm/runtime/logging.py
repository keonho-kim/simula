"""목적:
- LLM router/service가 공통으로 쓰는 로깅 helper를 제공한다.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from pydantic import BaseModel

from simula.infrastructure.llm.renderers import (
    render_object_response,
    render_simple_response,
    render_text_response,
)


def log_structured_transport_attempt_start(
    *,
    logger: Any,
    role: str,
    log_context: dict[str, object] | None,
) -> None:
    """Structured transport attempt 시작 로그를 남긴다."""

    header = _structured_attempt_header(role=role, log_context=log_context)
    logger.debug(
        "%s transport call 시작 | %s",
        header,
        _structured_attempt_suffix(log_context),
    )


def log_structured_transport_attempt_failure(
    *,
    logger: Any,
    role: str,
    error: Exception,
    log_context: dict[str, object] | None,
) -> None:
    """Structured transport attempt 실패 로그를 남긴다."""

    header = _structured_attempt_header(role=role, log_context=log_context)
    logger.debug(
        "%s transport call 실패 | %s | error=%s",
        header,
        _structured_attempt_suffix(log_context),
        error,
    )


def log_primary_parse_failure(
    *,
    logger: Any,
    role: str,
    last_error: Exception | None,
    last_content: str,
    log_context: dict[str, object] | None,
) -> None:
    """Primary parse failure 디버그 로그를 남긴다."""

    if last_error is None:
        return

    if log_context:
        task_label = str(log_context.get("task_label", "")).strip()
        header = f"{role} · {task_label}" if task_label else role
    else:
        header = role
    logger.debug(
        "\n%s primary structured parse failed\ncontext: %s\nparse_error: %s\nfull_response:\n%s\n",
        header,
        log_context or {},
        last_error,
        last_content,
    )


def format_log_context_suffix(log_context: dict[str, object] | None) -> str:
    """로그 제목에 붙일 context suffix를 생성한다."""

    if not log_context:
        return ""

    parts: list[str] = []
    artifact_key = log_context.get("artifact_key")
    if artifact_key is not None:
        parts.append(f"artifact={artifact_key}")

    schema_name = log_context.get("schema_name")
    if schema_name is not None:
        parts.append(f"schema={schema_name}")
    output_type_name = log_context.get("output_type_name")
    if output_type_name is not None and not str(schema_name or "").strip():
        parts.append(f"output_type={output_type_name}")

    round_index = log_context.get("round_index")
    if round_index is not None:
        parts.append(f"round_index={round_index}")

    actor_display_name = log_context.get("actor_display_name")
    cast_id = log_context.get("cast_id")
    if actor_display_name is not None and cast_id is not None:
        parts.append(f"actor={actor_display_name}({cast_id})")
    elif actor_display_name is not None:
        parts.append(f"actor={actor_display_name}")
    elif cast_id is not None:
        parts.append(f"cast_id={cast_id}")

    slot_index = log_context.get("slot_index")
    if slot_index is not None:
        parts.append(f"slot_index={slot_index}")

    section = log_context.get("section")
    if section is not None:
        parts.append(f"section={section}")

    target_role = log_context.get("target_role")
    target_task_key = log_context.get("target_task_key")
    if target_role is not None and target_task_key is not None:
        parts.append(f"target={target_role}.{target_task_key}")

    target_artifact_key = log_context.get("target_artifact_key")
    if target_artifact_key is not None:
        parts.append(f"target_artifact={target_artifact_key}")

    target_schema_name = log_context.get("target_schema_name")
    if target_schema_name is not None:
        parts.append(f"target_schema={target_schema_name}")

    attempt = log_context.get("attempt")
    if attempt is not None:
        attempt_total = log_context.get("attempt_total")
        if attempt_total is not None and "/" not in str(attempt):
            parts.append(f"attempt={attempt}/{attempt_total}")
        else:
            parts.append(f"attempt={attempt}")

    prompt_variant = log_context.get("prompt_variant")
    if prompt_variant is not None:
        parts.append(f"prompt_variant={prompt_variant}")
    retry_route = log_context.get("retry_route")
    if retry_route is not None:
        parts.append(f"retry_route={retry_route}")
    retry_reason = log_context.get("retry_reason")
    if retry_reason is not None:
        parts.append(f"retry_reason={retry_reason}")
    return " ".join(parts)


def format_call_start_message(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    """호출 시작 메시지를 생성한다."""

    return f"{format_response_header(role=role, log_context=log_context)} 시작"


def format_response_title(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    """응답 완료 제목을 생성한다."""

    return f"{format_response_header(role=role, log_context=log_context)} 완료"


def format_metrics_line(
    *,
    duration_seconds: float,
    ttft_seconds: float | None,
    input_tokens: int | None,
    output_tokens: int | None,
    total_tokens: int | None,
) -> str:
    """메트릭 요약 라인을 생성한다."""

    return (
        f"소요 {duration_seconds:.2f}s"
        f" | 첫 응답 {_format_optional_number(ttft_seconds)}"
        f" | 토큰 입력 {_format_optional_int(input_tokens)}"
        f" / 출력 {_format_optional_int(output_tokens)}"
        f" / 전체 {_format_optional_int(total_tokens)}"
    )


def pretty_object_response_text(
    *,
    role: str,
    parsed: BaseModel | None,
    content: str,
    log_context: dict[str, object] | None,
) -> str:
    """Object 응답 pretty text를 생성한다."""

    return render_object_response(
        role=role,
        parsed=parsed,
        content=strip_json_fence(content),
        log_context=log_context,
    )


def pretty_simple_response_text(
    *,
    role: str,
    parsed: object | None,
    content: str,
    output_type_name: str,
    log_context: dict[str, object] | None,
) -> str:
    """Simple 응답 pretty text를 생성한다."""

    return render_simple_response(
        role=role,
        parsed=parsed,
        content=strip_json_fence(content),
        output_type_name=output_type_name,
        log_context=log_context,
    )


def pretty_text_response_text(
    *,
    role: str,
    content: str,
    log_context: dict[str, object] | None,
) -> str:
    """텍스트 응답 pretty text를 생성한다."""

    return render_text_response(
        role=role,
        content=strip_json_fence(content),
        log_context=log_context,
    )


def json_safe_mapping(
    mapping: dict[str, object] | None,
) -> dict[str, object] | None:
    """JSONL event payload용으로 mapping을 안전하게 직렬화한다."""

    if mapping is None:
        return None
    return {str(key): json_safe_value(value) for key, value in mapping.items()}


def json_safe_value(value: object) -> object:
    """임의 값을 JSON-safe value로 변환한다."""

    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {str(key): json_safe_value(item) for key, item in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [json_safe_value(item) for item in value]
    return str(value)


def strip_json_fence(text: str) -> str:
    """Markdown JSON fence를 제거한다."""

    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def format_response_header(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    """역할/컨텍스트 기반 로그 헤더를 생성한다."""

    if log_context:
        task_label = str(log_context.get("task_label", "")).strip()
        target_role = str(log_context.get("target_role", "")).strip()
        target_task_label = str(log_context.get("target_task_label", "")).strip()
        if role == "fixer" and task_label and target_role and target_task_label:
            return f"fixer · {task_label}"
        if task_label:
            return f"{role} · {task_label}"

    scope = str(log_context.get("scope")) if log_context else ""
    if role == "planner":
        return _planner_scope_label(scope)
    if role == "generator":
        return "generator"
    if role == "actor":
        return "actor"
    if role == "observer":
        return _observer_scope_label(scope)
    if role == "coordinator":
        return _coordinator_scope_label(scope)
    if role == "fixer":
        return _fixer_scope_label(scope)
    return role


def _structured_attempt_header(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    if log_context:
        task_label = str(log_context.get("task_label", "")).strip()
        if task_label:
            return f"{role} · {task_label}"
    return role


def _structured_attempt_suffix(log_context: dict[str, object] | None) -> str:
    if not log_context:
        return "-"

    parts: list[str] = []
    artifact_key = str(log_context.get("artifact_key", "")).strip()
    if artifact_key:
        parts.append(f"artifact={artifact_key}")
    schema_name = str(log_context.get("schema_name", "")).strip()
    if schema_name:
        parts.append(f"schema={schema_name}")
    attempt = log_context.get("attempt")
    attempt_total = log_context.get("attempt_total")
    if attempt is not None and attempt_total is not None:
        parts.append(f"attempt={attempt}/{attempt_total}")
    elif attempt is not None:
        parts.append(f"attempt={attempt}")
    prompt_variant = str(log_context.get("prompt_variant", "")).strip()
    if prompt_variant:
        parts.append(f"prompt_variant={prompt_variant}")
    return " | ".join(parts) if parts else "-"


def _planner_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "planning-analysis": "planner · 계획 분석",
        "execution-plan": "planner · 실행 계획 정리",
    }
    base = labels.get(scope, "planner")
    if suffix:
        return f"{base} {suffix}"
    return base


def _observer_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "final-report": "observer · 최종 보고서 작성",
    }
    base = labels.get(scope, "관찰 요약")
    if suffix:
        return f"{base} {suffix}"
    return base


def _coordinator_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "round-continuation": "coordinator · 라운드 지속 여부 판단",
        "round-directive": "coordinator · 라운드 지시안 작성",
        "round-resolution": "coordinator · 라운드 해소",
    }
    base = labels.get(scope, "coordinator")
    if suffix:
        return f"{base} {suffix}"
    return base


def _fixer_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "json-fix": "fixer · JSON 복구",
    }
    base = labels.get(scope, "fixer")
    if suffix:
        return f"{base} {suffix}"
    return base


def _format_optional_int(value: int | None) -> str:
    if value is None:
        return "-"
    return str(value)


def _format_optional_number(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.2f}s"
