"""Shared structured contract execution loop."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Generic, TypeVar

from langchain_core.exceptions import OutputParserException
from pydantic import ValidationError

from simula.application.workflow.fixer import FixerOutcome
from simula.infrastructure.llm.runtime.content import content_to_text
from simula.infrastructure.llm.runtime.logging import (
    log_structured_transport_attempt_failure,
    log_structured_transport_attempt_start,
)
from simula.infrastructure.llm.runtime.metrics import merge_token_count, merge_ttft
from simula.infrastructure.llm.runtime.router import StructuredLLMRouter
from simula.infrastructure.llm.runtime.structured_retry import (
    AttemptMetrics,
    RetryClassification,
    build_attempt_log_context,
    build_attempt_record,
    classify_structured_error,
    coerce_missing_field_paths,
    log_retry_classification,
    log_retry_exhausted,
    log_retry_start,
    log_retry_success,
    merge_attempt_metrics,
    transport_prompt_text,
)

ParsedT = TypeVar("ParsedT")


@dataclass(slots=True)
class ParseResult(Generic[ParsedT]):
    """Parsed contract payload plus optional semantic metadata."""

    parsed: ParsedT
    semantic_coercion_reasons: list[str] = field(default_factory=list)
    post_coercion_valid: bool | None = None


@dataclass(slots=True)
class ContractLoopSuccess(Generic[ParsedT]):
    """Successful structured contract execution summary."""

    parsed: ParsedT
    content: str
    aggregate_metrics: AttemptMetrics
    attempts: list[Any]
    parse_failure_count: int
    final_retry_context: dict[str, object]
    fixer_used: bool
    semantic_coercion_reasons: list[str] = field(default_factory=list)
    post_coercion_valid: bool | None = None


@dataclass(slots=True)
class ContractLoopFailure:
    """Failed structured contract execution summary."""

    aggregate_metrics: AttemptMetrics
    attempts: list[Any]
    parse_failure_count: int
    last_error: Exception | None
    last_content: str
    final_retry_context: dict[str, object]
    fixer_used: bool
    semantic_coercion_reasons: list[str] = field(default_factory=list)
    post_coercion_valid: bool | None = None


async def run_contract_loop(
    *,
    router: StructuredLLMRouter,
    logger: Any,
    role: str,
    prompt: str,
    normalized_log_context: dict[str, object],
    format_instructions: str,
    failure_policy: str,
    retry_budget: int,
    parse_content: Callable[[str], ParseResult[ParsedT]],
    invoke_fixer: Callable[[str, Exception | None, int, RetryClassification], Awaitable[FixerOutcome]],
) -> ContractLoopSuccess[ParsedT] | ContractLoopFailure:
    """Run the shared structured retry loop for one contract."""

    aggregate_metrics = AttemptMetrics()
    attempts_buffer: list[Any] = []
    parse_failure_count = 0
    last_error: Exception | None = None
    last_content = ""
    semantic_coercion_reasons: list[str] = []
    post_coercion_valid: bool | None = None
    final_retry_context = build_attempt_log_context(
        normalized_log_context,
        attempt=1,
        attempt_total=retry_budget,
        prompt_variant="primary",
        retry_stage="initial_request",
        retry_route="initial_request",
        retry_reason="initial request",
        missing_field_paths=[],
    )
    pending_fixer: RetryClassification | None = None
    fixer_used = False

    for attempt_index in range(1, retry_budget + 1):
        if pending_fixer is not None:
            fixer_used = True
            final_retry_context = build_attempt_log_context(
                normalized_log_context,
                attempt=attempt_index,
                attempt_total=retry_budget,
                prompt_variant="fixer_repair",
                retry_stage="fixer_repair",
                retry_route="fixer_repair",
                retry_reason=pending_fixer.reason,
                missing_field_paths=pending_fixer.missing_field_paths,
            )
            log_retry_start(logger=logger, role=role, log_context=final_retry_context)
            fixer_outcome = await invoke_fixer(
                last_content,
                last_error,
                attempt_index,
                pending_fixer,
            )
            merge_attempt_metrics(
                aggregate_metrics,
                merge_ttft=merge_ttft,
                merge_token_count=merge_token_count,
                incoming=AttemptMetrics(
                    ttft_seconds=fixer_outcome.ttft_seconds,
                    input_tokens=fixer_outcome.input_tokens,
                    output_tokens=fixer_outcome.output_tokens,
                    total_tokens=fixer_outcome.total_tokens,
                ),
            )
            if fixer_outcome.succeeded:
                parsed_result = parse_content(fixer_outcome.content)
                semantic_coercion_reasons = list(
                    parsed_result.semantic_coercion_reasons
                )
                post_coercion_valid = parsed_result.post_coercion_valid
                log_retry_success(
                    logger=logger,
                    role=role,
                    log_context=final_retry_context,
                )
                return ContractLoopSuccess(
                    parsed=parsed_result.parsed,
                    content=fixer_outcome.content,
                    aggregate_metrics=aggregate_metrics,
                    attempts=attempts_buffer,
                    parse_failure_count=parse_failure_count
                    + fixer_outcome.parse_failure_count,
                    final_retry_context=final_retry_context,
                    fixer_used=True,
                    semantic_coercion_reasons=semantic_coercion_reasons,
                    post_coercion_valid=post_coercion_valid,
                )
            parse_failure_count += fixer_outcome.parse_failure_count
            last_error = fixer_outcome.parse_error or last_error
            last_content = fixer_outcome.content or last_content
            log_retry_exhausted(
                logger=logger,
                role=role,
                log_context=final_retry_context,
                error=last_error,
            )
            break

        prompt_variant = "primary" if attempt_index == 1 else "regen_retry"
        retry_stage = "initial_request" if attempt_index == 1 else "transport_regen"
        previous_error = (
            classify_structured_error(last_error)
            if last_error is not None
            else RetryClassification("non_retryable", "initial request", [])
        )
        final_retry_context = build_attempt_log_context(
            normalized_log_context,
            attempt=attempt_index,
            attempt_total=retry_budget,
            prompt_variant=prompt_variant,
            retry_stage=retry_stage,
            retry_route="initial_request" if attempt_index == 1 else "regen_retry",
            retry_reason=(
                "initial request"
                if attempt_index == 1
                else previous_error.reason
            ),
            missing_field_paths=(
                [] if attempt_index == 1 else previous_error.missing_field_paths
            ),
        )
        candidate_prompt = transport_prompt_text(
            prompt=prompt,
            format_instructions=format_instructions,
            prompt_variant=prompt_variant,
            retry_reason=str(final_retry_context.get("retry_reason", "")),
            missing_field_paths=coerce_missing_field_paths(
                final_retry_context.get("missing_field_paths")
            ),
        )
        if attempt_index > 1:
            log_retry_start(logger=logger, role=role, log_context=final_retry_context)
        log_structured_transport_attempt_start(
            logger=logger,
            role=role,
            log_context=final_retry_context,
        )
        transport = await router._ainvoke_with_metrics(
            role,
            candidate_prompt,
            call_kind="structured",
            log_context=final_retry_context,
        )
        attempt_log_context = {
            **final_retry_context,
            "transport_retry_attempt": transport.transport_retry_attempt,
            "transport_retry_budget": transport.transport_retry_budget,
            "transport_error_type": transport.transport_error_type,
        }
        merge_attempt_metrics(
            aggregate_metrics,
            merge_ttft=merge_ttft,
            merge_token_count=merge_token_count,
            incoming=AttemptMetrics(
                ttft_seconds=transport.ttft_seconds,
                input_tokens=transport.input_tokens,
                output_tokens=transport.output_tokens,
                total_tokens=transport.total_tokens,
            ),
        )
        try:
            content = content_to_text(transport.response.content).strip()
            if not content:
                raise ValueError("응답이 비어 있습니다.")
            parsed_result = parse_content(content)
            semantic_coercion_reasons = list(parsed_result.semantic_coercion_reasons)
            post_coercion_valid = parsed_result.post_coercion_valid
            attempts_buffer.append(
                build_attempt_record(
                    prompt=candidate_prompt,
                    raw_response=transport.raw_response,
                    log_context=attempt_log_context,
                    duration_seconds=transport.duration_seconds,
                    ttft_seconds=transport.ttft_seconds,
                    input_tokens=transport.input_tokens,
                    output_tokens=transport.output_tokens,
                    total_tokens=transport.total_tokens,
                    prompt_variant=prompt_variant,
                    parse_failure_count=0,
                )
            )
            if attempt_index > 1:
                log_retry_success(
                    logger=logger,
                    role=role,
                    log_context=attempt_log_context,
                )
            final_retry_context = attempt_log_context
            return ContractLoopSuccess(
                parsed=parsed_result.parsed,
                content=content,
                aggregate_metrics=aggregate_metrics,
                attempts=attempts_buffer,
                parse_failure_count=parse_failure_count,
                final_retry_context=final_retry_context,
                fixer_used=False,
                semantic_coercion_reasons=semantic_coercion_reasons,
                post_coercion_valid=post_coercion_valid,
            )
        except (OutputParserException, ValidationError, ValueError) as exc:
            last_error = exc
            last_content = transport.raw_response
            parse_failure_count += 1
            attempts_buffer.append(
                build_attempt_record(
                    prompt=candidate_prompt,
                    raw_response=transport.raw_response,
                    log_context=attempt_log_context,
                    duration_seconds=transport.duration_seconds,
                    ttft_seconds=transport.ttft_seconds,
                    input_tokens=transport.input_tokens,
                    output_tokens=transport.output_tokens,
                    total_tokens=transport.total_tokens,
                    prompt_variant=prompt_variant,
                    parse_failure_count=1,
                )
            )
            log_structured_transport_attempt_failure(
                logger=logger,
                role=role,
                error=exc,
                log_context=attempt_log_context,
            )
            classification = classify_structured_error(exc)
            log_retry_classification(
                logger=logger,
                role=role,
                log_context=attempt_log_context,
                classification=classification,
                error=exc,
            )
            final_retry_context = attempt_log_context
            if (
                classification.category == "missing_required_fields"
                and attempt_index < retry_budget
            ):
                continue
            if (
                classification.category in {"other_parse_failure", "semantic_failure"}
                and failure_policy == "fixer"
                and attempt_index < retry_budget
            ):
                pending_fixer = classification
                continue
            log_retry_exhausted(
                logger=logger,
                role=role,
                log_context=final_retry_context,
                error=exc,
            )
            break

    return ContractLoopFailure(
        aggregate_metrics=aggregate_metrics,
        attempts=attempts_buffer,
        parse_failure_count=parse_failure_count,
        last_error=last_error,
        last_content=last_content,
        final_retry_context=final_retry_context,
        fixer_used=fixer_used,
        semantic_coercion_reasons=semantic_coercion_reasons,
        post_coercion_valid=post_coercion_valid,
    )
