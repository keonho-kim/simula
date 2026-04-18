"""목적:
- structured parse 실패 시 fixer role을 이용해 JSON 복구를 시도한다.

설명:
- 실패한 응답 텍스트와 compact schema 요약을 fixer에 전달한다.
- fixer 단일 호출 후 즉시 재검증한다.

연관된 다른 모듈/구조:
- simula.infrastructure.llm.runtime.router
- simula.infrastructure.llm.output_parsers
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from types import UnionType
from typing import Any, Callable, Literal, Union, get_args, get_origin

from pydantic import BaseModel

from simula.shared.logging.llm import build_fixer_log_context
from simula.application.ports.llm import ObjectSemanticValidator, SimpleSemanticValidator
from simula.infrastructure.llm.output_parsers import parse_simple_output
from simula.infrastructure.llm.runtime import StructuredLLMRouter
from simula.infrastructure.llm.runtime.metrics import merge_token_count, merge_ttft

FIX_JSON_PROMPT = """# Role
You repair malformed JSON outputs.

# Goal
Rewrite the provided content into exactly one valid JSON value that satisfies the target schema.

# Rules
- Return one JSON value only.
- Return only the JSON value that matches the required output schema.
- Do not add markdown fences.
- Do not add explanations, notes, or commentary.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- If the root output is an array, return a JSON array and do not wrap it in an object.
- If the root output is an object, return a JSON object and do not wrap it in an array.
- Preserve the original meaning as much as possible.
- If parts are malformed, infer the smallest valid JSON rewrite that keeps the content intact.
- All required fields must be present.
- Enum values must match exactly.

# Target schema summary
{schema_summary}

{failure_feedback}

{repair_context}

# Input
Malformed content:
{failed_content}
"""

_KNOWN_VALIDATION_RULES: dict[str, tuple[str, ...]] = {
    "ScenarioTimeScope": (
        "start must not be empty.",
        "end must not be empty.",
    ),
    "RuntimeProgressionPlan": (
        "allowed_elapsed_units must not be empty.",
        "allowed_elapsed_units values must be unique.",
        "default_elapsed_unit must be included in allowed_elapsed_units.",
        "reason must not be empty.",
    ),
    "PlanningAnalysis": (
        "brief_summary must not be empty.",
        "premise must not be empty.",
    ),
    "ActionCatalog": (
        "actions must not be empty.",
        "action_type values must be unique.",
        "actions must contain at most 5 items.",
    ),
    "CoordinationFrame": (
        "focus_policy must not be empty.",
        "background_policy must not be empty.",
    ),
    "CastRoster": (
        "items must not be empty.",
        "cast_id values must be unique.",
        "display_name values must be unique.",
    ),
    "ExecutionPlanFrameBundle": (
        "major_events must use unique event_id values.",
        "major_events must contain at most 6 items.",
    ),
    "ExecutionPlanBundle": (
        "major_events must use unique event_id values.",
        "major_events must contain at most 6 items.",
    ),
    "ActorActionShell": (
        "action_type must not be empty.",
        "group proposals require target_cast_ids.",
    ),
    "ActorActionNarrative": (
        "goal must not be empty.",
        "summary must not be empty.",
        "detail must not be empty.",
    ),
    "RoundDirectiveFocusCore": (
        "focus_summary must not be empty.",
        "reason must not be empty.",
    ),
    "MajorEventPlanItem": (
        "participant_cast_ids must not be empty.",
        "completion_action_types must not be empty.",
        "completion_signals must not be empty.",
        "participant_cast_ids must be unique.",
        "completion_action_types must be unique.",
        "earliest_round must be less than or equal to latest_round.",
    ),
    "ObserverReportBody": (
        "summary must not be empty.",
        "atmosphere must not be empty.",
    ),
    "ActorFacingScenarioDigestBody": (
        "current_pressures must not be empty.",
        "next_step_notes must not be empty.",
    ),
    "RoundResolutionCore": (
        "adopted_cast_ids must be unique.",
        "world_state_summary must not be empty.",
    ),
}


@dataclass(slots=True)
class FixerOutcome:
    """JSON fixer 실행 결과다."""

    succeeded: bool
    content: str
    parse_error: Exception | None
    parse_failure_count: int
    ttft_seconds: float | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None


async def repair_structured_json(
    *,
    router: StructuredLLMRouter,
    target_role: str,
    target_log_context: dict[str, object] | None,
    parser: Any | None = None,
    annotation: Any | None = None,
    output_type_name: str | None = None,
    content: str,
    semantic_validator: (
        ObjectSemanticValidator[Any] | SimpleSemanticValidator[Any] | None
    ) = None,
    repair_context: dict[str, object] | None = None,
    failure_feedback: list[str] | None = None,
    attempt: int,
    retry_budget: int,
    retry_reason: str,
    missing_field_paths: list[str] | None = None,
) -> FixerOutcome:
    """fixer role로 malformed JSON 응답을 복구한다."""

    if not content.strip():
        return FixerOutcome(
            succeeded=False,
            content="",
            parse_error=None,
            parse_failure_count=0,
            ttft_seconds=None,
            input_tokens=None,
            output_tokens=None,
            total_tokens=None,
        )

    ttft_seconds: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    last_error: Exception | None = None
    parse_and_validate = _build_parse_and_validate(
        parser=parser,
        annotation=annotation,
        semantic_validator=semantic_validator,
    )
    schema_name = _resolve_schema_name(
        parser=parser,
        annotation=annotation,
        output_type_name=output_type_name,
    )

    fixed_content, meta = await router.ainvoke_text_with_meta(
        "fixer",
        _build_fix_json_prompt(
            parser=parser,
            annotation=annotation,
            output_type_name=output_type_name,
            failed_content=content,
            failure_feedback=failure_feedback,
            repair_context=repair_context,
        ),
        log_context=build_fixer_log_context(
            attempt=attempt,
            target_role=target_role,
            target_log_context=target_log_context,
            schema_name=schema_name,
            retry_budget=retry_budget,
            retry_reason=retry_reason,
            missing_field_paths=missing_field_paths,
        ),
    )
    ttft_seconds = merge_ttft(ttft_seconds, meta.ttft_seconds)
    input_tokens = merge_token_count(input_tokens, meta.input_tokens)
    output_tokens = merge_token_count(output_tokens, meta.output_tokens)
    total_tokens = merge_token_count(total_tokens, meta.total_tokens)
    try:
        parse_and_validate(fixed_content)
        return FixerOutcome(
            succeeded=True,
            content=fixed_content,
            parse_error=None,
            parse_failure_count=0,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
    except Exception as exc:  # noqa: BLE001
        last_error = ValueError(f"json fixer failed: {exc}")
        router.logger.debug(
            "fixer 복구 실패 | attempt=%s/%s | target_role=%s | error=%s",
            attempt,
            retry_budget,
            target_role,
            exc,
        )

    return FixerOutcome(
        succeeded=False,
        content=fixed_content,
        parse_error=last_error,
        parse_failure_count=1,
        ttft_seconds=ttft_seconds,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
    )


def _build_fix_json_prompt(
    *,
    parser: Any | None,
    annotation: Any | None,
    output_type_name: str | None,
    failed_content: str,
    failure_feedback: list[str] | None = None,
    repair_context: dict[str, object] | None = None,
) -> str:
    return FIX_JSON_PROMPT.format(
        schema_summary=_render_compact_schema_summary(
            parser=parser,
            annotation=annotation,
            output_type_name=output_type_name,
        ),
        failure_feedback=_render_failure_feedback(failure_feedback),
        repair_context=_render_repair_context(repair_context),
        failed_content=failed_content,
    )


def _render_compact_schema_summary(
    *,
    parser: Any | None,
    annotation: Any | None,
    output_type_name: str | None,
) -> str:
    schema = getattr(parser, "target_schema", None)
    if isinstance(schema, type) and issubclass(schema, BaseModel):
        lines = [f"Target schema: {schema.__name__}", "Fields:"]
        lines.extend(_collect_field_lines(schema))

        validation_rules = _collect_validation_rules(schema)
        if validation_rules:
            lines.append("Validation rules:")
            lines.extend(f"- {rule}" for rule in validation_rules)
        return "\n".join(lines)

    if annotation is None:
        label = output_type_name or "UnknownSchema"
        return f"Target schema: {label}\n- Return one valid JSON value."

    lines = [f"Target schema: {output_type_name or _describe_annotation(annotation)}"]
    lines.extend(_collect_annotation_lines(annotation, prefix="root"))

    root_model = _extract_base_model_from_annotation(annotation)
    if root_model is not None:
        validation_rules = _collect_validation_rules(root_model)
        if validation_rules:
            lines.append("Validation rules:")
            lines.extend(f"- {rule}" for rule in validation_rules)
    return "\n".join(lines)


def _collect_field_lines(
    schema: type[BaseModel],
    *,
    prefix: str = "",
) -> list[str]:
    lines: list[str] = []
    for field_name, field in schema.model_fields.items():
        field_path = f"{prefix}.{field_name}" if prefix else field_name
        annotation = _unwrap_optional_annotation(field.annotation)
        nested_model = _extract_base_model(annotation)
        required_marker = "required" if field.is_required() else "optional"
        if nested_model is not None:
            lines.append(f"- {field_path}: object ({required_marker})")
            lines.extend(_collect_field_lines(nested_model, prefix=field_path))
            continue
        lines.append(
            f"- {field_path}: {_describe_annotation(annotation)} ({required_marker})"
        )
    return lines


def _collect_annotation_lines(
    annotation: Any,
    *,
    prefix: str,
) -> list[str]:
    normalized = _unwrap_optional_annotation(annotation)
    origin = get_origin(normalized)
    args = get_args(normalized)
    nested_model = _extract_base_model(normalized)
    if nested_model is not None:
        lines = [f"- {prefix}: object[{nested_model.__name__}]"]
        lines.extend(_collect_field_lines(nested_model, prefix=prefix))
        return lines
    if origin is list and args:
        lines = [f"- {prefix}: array[{_describe_annotation(_unwrap_optional_annotation(args[0]))}]"]
        item_model = _extract_base_model_from_annotation(args[0])
        if item_model is not None:
            lines.extend(_collect_field_lines(item_model, prefix=f"{prefix}[]"))
        return lines
    return [f"- {prefix}: {_describe_annotation(normalized)}"]


def _collect_validation_rules(schema: type[BaseModel]) -> list[str]:
    lines: list[str] = []
    visited: set[type[BaseModel]] = set()

    def visit(model: type[BaseModel]) -> None:
        if model in visited:
            return
        visited.add(model)

        for rule in _known_validation_rules_for_model(model):
            if rule not in lines:
                lines.append(rule)

        for field in model.model_fields.values():
            nested_model = _extract_base_model(
                _unwrap_optional_annotation(field.annotation)
            )
            if nested_model is not None:
                visit(nested_model)

    visit(schema)
    return lines


def _render_failure_feedback(failure_feedback: list[str] | None) -> str:
    if not failure_feedback:
        return "Validation issues:\n- None provided."

    lines = ["Validation issues:"]
    lines.extend(f"- {item}" for item in failure_feedback if item.strip())
    return "\n".join(lines)


def _render_repair_context(repair_context: dict[str, object] | None) -> str:
    if not repair_context:
        return "Repair context:\n- None provided."

    lines = ["Repair context:"]
    for key, value in repair_context.items():
        if key == "repair_guidance" and isinstance(value, list):
            guidance_items = [str(item).strip() for item in value if str(item).strip()]
            if guidance_items:
                lines.extend(f"- {item}" for item in guidance_items)
                continue
        lines.append(f"- {key}: {_render_context_value(value)}")
    return "\n".join(lines)


def _known_validation_rules_for_model(model: type[BaseModel]) -> tuple[str, ...]:
    if model.__name__ == "ActorActionProposal":
        from simula.application.workflow.graphs.runtime.proposal_contract import (
            actor_proposal_target_rule_lines,
        )

        return actor_proposal_target_rule_lines()
    return _KNOWN_VALIDATION_RULES.get(model.__name__, ())


def _render_context_value(value: object) -> str:
    if isinstance(value, list):
        if not value:
            return "[]"
        if all(not isinstance(item, (dict, list)) for item in value):
            return ", ".join(str(item) for item in value)
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def _describe_annotation(annotation: Any) -> str:
    origin = get_origin(annotation)
    args = get_args(annotation)

    if origin is Literal:
        rendered_args = ", ".join(str(arg) for arg in args)
        return f"enum[{rendered_args}]"

    if origin is list and args:
        return f"array[{_describe_annotation(_unwrap_optional_annotation(args[0]))}]"

    if origin is dict and len(args) == 2:
        key_type = _describe_annotation(_unwrap_optional_annotation(args[0]))
        value_type = _describe_annotation(_unwrap_optional_annotation(args[1]))
        return f"object[{key_type} -> {value_type}]"

    nested_model = _extract_base_model(annotation)
    if nested_model is not None:
        return f"object[{nested_model.__name__}]"

    if annotation is str:
        return "string"
    if annotation is int:
        return "integer"
    if annotation is float:
        return "number"
    if annotation is bool:
        return "boolean"
    return getattr(annotation, "__name__", str(annotation))


def _resolve_schema_name(
    *,
    parser: Any | None,
    annotation: Any | None,
    output_type_name: str | None,
) -> str:
    schema = getattr(parser, "target_schema", None)
    if isinstance(schema, type) and issubclass(schema, BaseModel):
        return schema.__name__
    if output_type_name and output_type_name.strip():
        return output_type_name.strip()
    if annotation is not None:
        return _describe_annotation(annotation)
    return "UnknownSchema"


def _build_parse_and_validate(
    *,
    parser: Any | None,
    annotation: Any | None,
    semantic_validator: (
        ObjectSemanticValidator[Any] | SimpleSemanticValidator[Any] | None
    ),
) -> Callable[[str], object]:
    if parser is not None:
        def parse_and_validate(text: str) -> object:
            parsed = parser.parse(text)
            semantic_issues = _run_semantic_validator(
                parsed,
                semantic_validator=semantic_validator,
            )
            if semantic_issues:
                raise ValueError("; ".join(semantic_issues))
            return parsed

        return parse_and_validate

    if annotation is None:
        raise ValueError("parser 또는 annotation 중 하나는 필요합니다.")

    def parse_and_validate(text: str) -> object:
        parsed = parse_simple_output(text, annotation)
        semantic_issues = _run_semantic_validator(
            parsed,
            semantic_validator=semantic_validator,
        )
        if semantic_issues:
            raise ValueError("; ".join(semantic_issues))
        return parsed

    return parse_and_validate


def _unwrap_optional_annotation(annotation: Any) -> Any:
    origin = get_origin(annotation)
    if origin in (UnionType, Union):
        union_args = get_args(annotation)
        non_none_args = [arg for arg in union_args if arg is not type(None)]
        if len(non_none_args) == 1 and len(non_none_args) != len(union_args):
            return non_none_args[0]

    return annotation


def _extract_base_model(annotation: Any) -> type[BaseModel] | None:
    if not isinstance(annotation, type):
        return None
    if not issubclass(annotation, BaseModel):
        return None
    return annotation


def _extract_base_model_from_annotation(annotation: Any) -> type[BaseModel] | None:
    normalized = _unwrap_optional_annotation(annotation)
    nested_model = _extract_base_model(normalized)
    if nested_model is not None:
        return nested_model
    origin = get_origin(normalized)
    args = get_args(normalized)
    if origin is list and args:
        return _extract_base_model(_unwrap_optional_annotation(args[0]))
    return None


def _run_semantic_validator(
    parsed: object,
    *,
    semantic_validator: (
        ObjectSemanticValidator[Any] | SimpleSemanticValidator[Any] | None
    ),
) -> list[str]:
    if semantic_validator is None:
        return []
    issues = semantic_validator(parsed)
    return [issue.strip() for issue in issues if issue.strip()]
