"""목적:
- structured parse 실패 시 fixer role을 이용해 JSON 복구를 시도한다.

설명:
- 실패한 응답 텍스트와 compact schema 요약을 fixer에 전달한다.
- `json_repair + schema validation`으로 즉시 재검증한다.

사용한 설계 패턴:
- helper function + retry loop 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.router
- simula.infrastructure.llm.output_parsers
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from types import UnionType
from typing import Any, Literal, Union, get_args, get_origin

from pydantic import BaseModel

from simula.application.ports.llm import SemanticValidator
from simula.infrastructure.llm.router import (
    StructuredLLMRouter,
    _merge_token_count,
    _merge_ttft,
)

FIX_JSON_PROMPT = """# Role
You repair malformed JSON outputs.

# Goal
Rewrite the provided content into exactly one valid JSON object that satisfies the target schema.

# Rules
- Return one JSON object only.
- Return only the JSON object that matches the required output schema.
- Do not add markdown fences.
- Do not add explanations, notes, or commentary.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
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
        "selection_reason must not be empty.",
    ),
    "PlanningAnalysis": (
        "brief_summary must not be empty.",
        "premise must not be empty.",
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
    parser: Any,
    content: str,
    semantic_validator: SemanticValidator[Any] | None = None,
    repair_context: dict[str, object] | None = None,
    failure_feedback: list[str] | None = None,
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

    current_content = content
    ttft_seconds: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    parse_failure_count = 0
    last_error: Exception | None = None

    for attempt in range(4):
        fixed_content, meta = await router.ainvoke_text_with_meta(
            "fixer",
            _build_fix_json_prompt(
                parser=parser,
                failed_content=current_content,
                failure_feedback=failure_feedback,
                repair_context=repair_context,
            ),
            log_context={
                "scope": "json-fix",
                "attempt": attempt + 1,
            },
        )
        ttft_seconds = _merge_ttft(ttft_seconds, meta.ttft_seconds)
        input_tokens = _merge_token_count(input_tokens, meta.input_tokens)
        output_tokens = _merge_token_count(output_tokens, meta.output_tokens)
        total_tokens = _merge_token_count(total_tokens, meta.total_tokens)
        try:
            parsed = parser.parse(fixed_content)
            semantic_issues = _run_semantic_validator(
                parsed,
                semantic_validator=semantic_validator,
            )
            if semantic_issues:
                raise ValueError("; ".join(semantic_issues))
            return FixerOutcome(
                succeeded=True,
                content=fixed_content,
                parse_error=None,
                parse_failure_count=parse_failure_count,
                ttft_seconds=ttft_seconds,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
            )
        except Exception as exc:  # noqa: BLE001
            parse_failure_count += 1
            current_content = fixed_content
            last_error = ValueError(f"json fixer failed: {exc}")
            failure_feedback = [str(exc)]
            if attempt < 3:
                router.logger.warning(
                    "json fixer 재시도 대기 | attempt=%s/%s | error=%s",
                    attempt + 1,
                    4,
                    exc,
                )
                await asyncio.sleep(0.25 * (attempt + 1))

    return FixerOutcome(
        succeeded=False,
        content=current_content,
        parse_error=last_error,
        parse_failure_count=parse_failure_count,
        ttft_seconds=ttft_seconds,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
    )


def _build_fix_json_prompt(
    *,
    parser: Any,
    failed_content: str,
    failure_feedback: list[str] | None = None,
    repair_context: dict[str, object] | None = None,
) -> str:
    return FIX_JSON_PROMPT.format(
        schema_summary=_render_compact_schema_summary(parser),
        failure_feedback=_render_failure_feedback(failure_feedback),
        repair_context=_render_repair_context(repair_context),
        failed_content=failed_content,
    )


def _render_compact_schema_summary(parser: Any) -> str:
    schema = getattr(parser, "target_schema", None)
    if not isinstance(schema, type) or not issubclass(schema, BaseModel):
        return "- Unknown schema. Return a single valid JSON object."

    lines = [f"Target schema: {schema.__name__}", "Fields:"]
    lines.extend(_collect_field_lines(schema))

    validation_rules = _collect_validation_rules(schema)
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


def _run_semantic_validator(
    parsed: BaseModel,
    *,
    semantic_validator: SemanticValidator[Any] | None,
) -> list[str]:
    if semantic_validator is None:
        return []
    issues = semantic_validator(parsed)
    return [issue.strip() for issue in issues if issue.strip()]
