"""Purpose:
- Provide one stable log-context contract for all LLM calls.

Description:
- Keep task/result metadata consistent across workflow call sites, runtime logger output,
  JSONL `llm_call` events, usage summaries, and fixer attribution.
"""

from __future__ import annotations

from pydantic import BaseModel

_EMPTY_SEQUENCE_TYPES = (list, tuple, set, frozenset)


def build_llm_log_context(
    *,
    scope: str,
    task_key: str,
    task_label: str,
    artifact_key: str,
    artifact_label: str,
    phase: str,
    schema: type[BaseModel] | None = None,
    **extra: object,
) -> dict[str, object]:
    """Build one normalized log_context payload for an LLM call site."""

    context: dict[str, object] = {
        "scope": scope,
        "task_key": task_key,
        "task_label": task_label,
        "artifact_key": artifact_key,
        "artifact_label": artifact_label,
        "phase": phase,
    }
    if schema is not None:
        context["schema_name"] = schema.__name__
    for key, value in extra.items():
        if _has_value(value):
            context[key] = value
    return context


def ensure_llm_log_context(
    log_context: dict[str, object] | None,
    *,
    role: str,
    schema: type[BaseModel] | None = None,
) -> dict[str, object]:
    """Normalize a log_context so downstream code can rely on stable keys."""

    normalized = dict(log_context or {})
    scope = _string_value(normalized.get("scope"))
    task_key = _string_value(normalized.get("task_key")) or _scope_to_task_key(scope)
    if task_key:
        normalized["task_key"] = task_key

    task_label = _string_value(normalized.get("task_label"))
    if not task_label and task_key:
        task_label = task_key.replace(".", " ").replace("_", " ")
    if task_label:
        normalized["task_label"] = task_label

    artifact_key = _string_value(normalized.get("artifact_key"))
    if not artifact_key:
        if role == "fixer":
            artifact_key = (
                _string_value(normalized.get("target_artifact_key")) or "repaired_json"
            )
        elif task_key:
            artifact_key = task_key
    if artifact_key:
        normalized["artifact_key"] = artifact_key

    artifact_label = _string_value(normalized.get("artifact_label")) or artifact_key
    if artifact_label:
        normalized["artifact_label"] = artifact_label

    if schema is not None and not _string_value(normalized.get("schema_name")):
        normalized["schema_name"] = schema.__name__

    if not _string_value(normalized.get("phase")) and role == "fixer":
        normalized["phase"] = "repair"

    return normalized


def build_fixer_log_context(
    *,
    attempt: int,
    target_role: str,
    target_log_context: dict[str, object] | None,
    schema_name: str,
) -> dict[str, object]:
    """Build a fixer log_context that keeps the original task attribution."""

    normalized_target = ensure_llm_log_context(
        target_log_context,
        role=target_role,
    )
    target_task_key = _string_value(normalized_target.get("task_key")) or "unknown"
    target_task_label = (
        _string_value(normalized_target.get("task_label")) or target_task_key
    )
    target_artifact_key = (
        _string_value(normalized_target.get("artifact_key")) or target_task_key
    )
    target_artifact_label = (
        _string_value(normalized_target.get("artifact_label")) or target_artifact_key
    )

    return build_llm_log_context(
        scope="json-fix",
        task_key=f"json_repair.{target_role}.{target_task_key}",
        task_label=f"JSON 복구 ({target_role} · {target_task_label})",
        artifact_key="repaired_json",
        artifact_label="repaired_json",
        phase="repair",
        attempt=attempt,
        target_role=target_role,
        target_task_key=target_task_key,
        target_task_label=target_task_label,
        target_artifact_key=target_artifact_key,
        target_artifact_label=target_artifact_label,
        target_schema_name=schema_name,
    )


def task_counter_key(role: str, log_context: dict[str, object] | None) -> str:
    """Return the stable counter key for one transport call."""

    normalized = ensure_llm_log_context(log_context, role=role)
    task_key = _string_value(normalized.get("task_key")) or "unknown"
    return f"{role}.{task_key}"


def _scope_to_task_key(scope: str) -> str:
    stripped = scope.strip()
    if not stripped:
        return ""
    return stripped.replace("-", "_")


def _string_value(value: object) -> str:
    return str(value or "").strip()


def _has_value(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, _EMPTY_SEQUENCE_TYPES):
        return bool(value)
    if isinstance(value, dict):
        return bool(value)
    return True
