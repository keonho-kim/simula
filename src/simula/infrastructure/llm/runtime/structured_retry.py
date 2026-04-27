"""Shared structured retry helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, cast

from langchain_core.exceptions import OutputParserException
from pydantic import ValidationError

from simula.infrastructure.llm.runtime.router import StructuredLLMRouter

RetryCategory = Literal[
    "missing_required_fields",
    "other_parse_failure",
    "semantic_failure",
    "non_retryable",
]
RetryStage = Literal["initial_request", "transport_regen", "fixer_repair"]


@dataclass(slots=True)
class AttemptRecord:
    """One structured transport attempt record."""

    prompt: str
    raw_response: str
    log_context: dict[str, object]
    duration_seconds: float
    ttft_seconds: float | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    prompt_variant: str
    parse_failure_count: int


@dataclass(slots=True)
class RetryClassification:
    """Retry routing decision."""

    category: RetryCategory
    reason: str
    missing_field_paths: list[str]


@dataclass(slots=True)
class AttemptMetrics:
    """Aggregate metrics across transport/fixer attempts."""

    ttft_seconds: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None


def initial_retry_context(
    log_context: dict[str, object],
    *,
    retry_budget: int,
) -> dict[str, object]:
    return build_attempt_log_context(
        log_context,
        attempt=1,
        attempt_total=retry_budget,
        prompt_variant="primary",
        retry_stage="initial_request",
        retry_route="initial_request",
        retry_reason="initial request",
        missing_field_paths=[],
    )


def transport_prompt_text(
    *,
    prompt: str,
    format_instructions: str,
    prompt_variant: str,
    retry_reason: str,
    missing_field_paths: list[str],
) -> str:
    if prompt_variant == "primary":
        return prompt
    lines = [
        prompt,
        "",
        format_instructions,
        "Do not add code fences or explanatory text.",
    ]
    if retry_reason.strip():
        lines.append(f"Retry reason: {retry_reason.strip()}.")
    if missing_field_paths:
        lines.append(
            "Missing required fields: " + ", ".join(missing_field_paths) + "."
        )
    return "\n".join(lines)


def coerce_missing_field_paths(value: object) -> list[str]:
    """Return retry missing-field paths from a loosely typed log context value."""

    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def build_attempt_log_context(
    log_context: dict[str, object] | None,
    *,
    attempt: int,
    attempt_total: int,
    prompt_variant: str,
    retry_stage: RetryStage,
    retry_route: str,
    retry_reason: str,
    missing_field_paths: list[str],
) -> dict[str, object]:
    enriched = dict(log_context or {})
    enriched["attempt"] = attempt
    enriched["attempt_total"] = attempt_total
    enriched["prompt_variant"] = prompt_variant
    enriched["retry_stage"] = retry_stage
    enriched["retry_route"] = retry_route
    enriched["retry_attempt"] = attempt
    enriched["retry_budget"] = attempt_total
    enriched["retry_reason"] = retry_reason
    enriched["missing_field_paths"] = list(missing_field_paths)
    return enriched


def build_attempt_record(
    *,
    prompt: str,
    raw_response: str,
    log_context: dict[str, object],
    duration_seconds: float,
    ttft_seconds: float | None,
    input_tokens: int | None,
    output_tokens: int | None,
    total_tokens: int | None,
    prompt_variant: str,
    parse_failure_count: int,
) -> AttemptRecord:
    return AttemptRecord(
        prompt=prompt,
        raw_response=raw_response,
        log_context=log_context,
        duration_seconds=duration_seconds,
        ttft_seconds=ttft_seconds,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        prompt_variant=prompt_variant,
        parse_failure_count=parse_failure_count,
    )


def merge_attempt_metrics(
    aggregate: AttemptMetrics,
    *,
    merge_ttft: Any,
    merge_token_count: Any,
    incoming: AttemptMetrics,
) -> None:
    aggregate.ttft_seconds = merge_ttft(aggregate.ttft_seconds, incoming.ttft_seconds)
    aggregate.input_tokens = merge_token_count(
        aggregate.input_tokens,
        incoming.input_tokens,
    )
    aggregate.output_tokens = merge_token_count(
        aggregate.output_tokens,
        incoming.output_tokens,
    )
    aggregate.total_tokens = merge_token_count(
        aggregate.total_tokens,
        incoming.total_tokens,
    )


def log_retry_start(
    *,
    logger: Any,
    role: str,
    log_context: dict[str, object],
) -> None:
    logger.info(
        "%s structured RETRY 시작 | attempt=%s/%s | route=%s | reason=%s",
        role,
        log_context.get("retry_attempt"),
        log_context.get("retry_budget"),
        log_context.get("retry_route"),
        log_context.get("retry_reason"),
    )


def log_retry_success(
    *,
    logger: Any,
    role: str,
    log_context: dict[str, object],
) -> None:
    logger.info(
        "%s structured RETRY 성공 | attempt=%s/%s | route=%s",
        role,
        log_context.get("retry_attempt"),
        log_context.get("retry_budget"),
        log_context.get("retry_route"),
    )


def log_retry_exhausted(
    *,
    logger: Any,
    role: str,
    log_context: dict[str, object],
    error: Exception | None,
) -> None:
    logger.info(
        "%s structured RETRY 종료 | attempt=%s/%s | route=%s | error=%s",
        role,
        log_context.get("retry_attempt"),
        log_context.get("retry_budget"),
        log_context.get("retry_route"),
        error,
    )


def log_retry_classification(
    *,
    logger: Any,
    role: str,
    log_context: dict[str, object],
    classification: RetryClassification,
    error: Exception,
) -> None:
    logger.debug(
        "%s structured retry 분류 | attempt=%s/%s | category=%s | route=%s | missing_fields=%s | error=%s",
        role,
        log_context.get("retry_attempt"),
        log_context.get("retry_budget"),
        classification.category,
        (
            "regen_retry"
            if classification.category == "missing_required_fields"
            else "fixer_repair"
        ),
        classification.missing_field_paths,
        error,
    )


def classify_structured_error(error: Exception) -> RetryClassification:
    validation_error = extract_validation_error(error)
    if validation_error is not None:
        missing_paths = missing_field_paths(validation_error)
        if missing_paths:
            return RetryClassification(
                category="missing_required_fields",
                reason="missing required fields",
                missing_field_paths=missing_paths,
            )
        return RetryClassification(
            category="other_parse_failure",
            reason="json parse/type mismatch",
            missing_field_paths=[],
        )

    if isinstance(error, OutputParserException):
        return RetryClassification(
            category="other_parse_failure",
            reason="json parse/type mismatch",
            missing_field_paths=[],
        )

    if isinstance(error, ValueError):
        message = str(error).strip()
        if message == "응답이 비어 있습니다.":
            return RetryClassification(
                category="other_parse_failure",
                reason="empty response",
                missing_field_paths=[],
            )
        return RetryClassification(
            category="semantic_failure",
            reason=message or "semantic validation failure",
            missing_field_paths=[],
        )

    return RetryClassification(
        category="non_retryable",
        reason=str(error).strip() or type(error).__name__,
        missing_field_paths=[],
    )


def extract_validation_error(error: Exception | None) -> ValidationError | None:
    current = error
    visited: set[int] = set()
    while current is not None and id(current) not in visited:
        visited.add(id(current))
        if isinstance(current, ValidationError):
            return current
        current = cast(Exception | None, current.__cause__ or current.__context__)
    return None


def missing_field_paths(error: ValidationError) -> list[str]:
    paths: list[str] = []
    for item in error.errors(include_url=False):
        if str(item.get("type", "")).strip() != "missing":
            continue
        path = render_error_loc(cast(tuple[object, ...], item.get("loc", ())))
        if path and path not in paths:
            paths.append(path)
    return paths


def render_error_loc(loc: tuple[object, ...]) -> str:
    if not loc:
        return ""
    parts: list[str] = []
    for item in loc:
        if isinstance(item, int):
            parts.append(f"[{item}]")
            continue
        text = str(item).strip()
        if not text:
            continue
        if parts:
            parts.append(f".{text}")
        else:
            parts.append(text)
    return "".join(parts)


def final_prompt_variant(attempts: list[AttemptRecord]) -> str:
    if not attempts:
        return ""
    return attempts[-1].prompt_variant


def emit_contract_attempt_events(
    *,
    router: StructuredLLMRouter,
    role: str,
    contract_kind: str,
    output_type_name: str,
    attempts: list[AttemptRecord],
    provider_structured_mode: str,
    forced_default: bool,
    fixer_used: bool,
    semantic_coercion_reasons: list[str] | None = None,
    post_coercion_valid: bool | None = None,
) -> None:
    if not attempts:
        return
    last_index = len(attempts) - 1
    for index, attempt in enumerate(attempts):
        log_context = dict(attempt.log_context)
        log_context["contract_kind"] = contract_kind
        log_context["output_type_name"] = output_type_name
        log_context["provider_structured_mode"] = provider_structured_mode
        router._emit_llm_call_event(
            role=role,
            call_kind="structured",
            prompt=attempt.prompt,
            raw_response=attempt.raw_response,
            log_context=log_context,
            duration_seconds=attempt.duration_seconds,
            ttft_seconds=attempt.ttft_seconds,
            input_tokens=attempt.input_tokens,
            output_tokens=attempt.output_tokens,
            total_tokens=attempt.total_tokens,
            contract_kind=contract_kind,
            output_type_name=output_type_name,
            parse_failure_count=attempt.parse_failure_count,
            forced_default=forced_default and index == last_index,
            fixer_used=fixer_used and index == last_index,
            provider_structured_mode=provider_structured_mode,
            prompt_variant=attempt.prompt_variant,
            semantic_coercion_used=bool(semantic_coercion_reasons) and index == last_index,
            semantic_coercion_reasons=(
                list(semantic_coercion_reasons or []) if index == last_index else []
            ),
            post_coercion_valid=(post_coercion_valid if index == last_index else None),
        )
    attempts.clear()
