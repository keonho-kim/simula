"""Base analyzer records and shared numeric summaries."""

from __future__ import annotations

from typing import TYPE_CHECKING
from dataclasses import dataclass, field
from pathlib import Path

from simula.application.analysis.localization import (
    call_kind_label,
    metric_label,
    role_label,
)

if TYPE_CHECKING:
    from simula.application.analysis.models.reports import PlannedActionRecord


@dataclass(slots=True)
class LLMCallRecord:
    """Normalized `llm_call` event row."""

    run_id: str
    sequence: int
    role: str
    call_kind: str
    contract_kind: str
    output_type_name: str
    prompt: str
    raw_response: str
    log_context: dict[str, object]
    duration_seconds: float
    ttft_seconds: float | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    parse_failure_count: int
    forced_default: bool
    fixer_used: bool
    provider_structured_mode: str
    prompt_variant: str
    semantic_coercion_used: bool
    semantic_coercion_reasons: list[str]
    post_coercion_valid: bool | None
    retry_stage: str = ""
    retry_route: str = ""
    retry_attempt: int = 0
    retry_budget: int = 0
    retry_reason: str = ""
    missing_field_paths: list[str] = field(default_factory=list)
    transport_retry_attempt: int = 1
    transport_retry_budget: int = 1
    transport_error_type: str = ""

    @property
    def scope(self) -> str:
        return str(self.log_context.get("scope", "")).strip()

    @property
    def phase(self) -> str:
        return str(self.log_context.get("phase", "")).strip()

    @property
    def task_key(self) -> str:
        return str(self.log_context.get("task_key", "")).strip()

    @property
    def task_label(self) -> str:
        return str(self.log_context.get("task_label", "")).strip()

    @property
    def artifact_key(self) -> str:
        return str(self.log_context.get("artifact_key", "")).strip()

    @property
    def artifact_label(self) -> str:
        return str(self.log_context.get("artifact_label", "")).strip()

    @property
    def schema_name(self) -> str:
        return str(self.log_context.get("schema_name", "")).strip()

    @property
    def effective_output_type_name(self) -> str:
        if self.output_type_name.strip():
            return self.output_type_name.strip()
        return self.schema_name

    @property
    def section(self) -> str:
        return str(self.log_context.get("section", "")).strip()

    @property
    def target_role(self) -> str:
        return str(self.log_context.get("target_role", "")).strip()

    @property
    def target_task_key(self) -> str:
        return str(self.log_context.get("target_task_key", "")).strip()

    @property
    def target_artifact_key(self) -> str:
        return str(self.log_context.get("target_artifact_key", "")).strip()

    @property
    def target_schema_name(self) -> str:
        return str(self.log_context.get("target_schema_name", "")).strip()

    @property
    def fixer_schema_name(self) -> str:
        return self.target_schema_name or self.schema_name

    @property
    def task_identifier(self) -> str:
        if not self.task_key:
            return self.role
        return f"{self.role}.{self.task_key}"

    def to_row(self) -> dict[str, object]:
        return {
            "run_id": self.run_id,
            "sequence": self.sequence,
            "role": self.role,
            "role_label": role_label(self.role),
            "call_kind": self.call_kind,
            "call_kind_label": call_kind_label(self.call_kind),
            "contract_kind": self.contract_kind,
            "output_type_name": self.effective_output_type_name,
            "scope": self.scope,
            "phase": self.phase,
            "task_key": self.task_key,
            "task_label": self.task_label,
            "artifact_key": self.artifact_key,
            "artifact_label": self.artifact_label,
            "schema_name": self.schema_name,
            "section": self.section,
            "target_role": self.target_role,
            "target_task_key": self.target_task_key,
            "target_artifact_key": self.target_artifact_key,
            "target_schema_name": self.target_schema_name,
            "duration_seconds": self.duration_seconds,
            "ttft_seconds": self.ttft_seconds,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "parse_failure_count": self.parse_failure_count,
            "forced_default": self.forced_default,
            "fixer_used": self.fixer_used,
            "provider_structured_mode": self.provider_structured_mode,
            "prompt_variant": self.prompt_variant,
            "semantic_coercion_used": self.semantic_coercion_used,
            "semantic_coercion_reasons": self.semantic_coercion_reasons,
            "post_coercion_valid": self.post_coercion_valid,
            "retry_stage": self.retry_stage,
            "retry_route": self.retry_route,
            "retry_attempt": self.retry_attempt,
            "retry_budget": self.retry_budget,
            "retry_reason": self.retry_reason,
            "missing_field_paths": self.missing_field_paths,
            "transport_retry_attempt": self.transport_retry_attempt,
            "transport_retry_budget": self.transport_retry_budget,
            "transport_error_type": self.transport_error_type,
            "log_context": self.log_context,
            "prompt": self.prompt,
            "raw_response": self.raw_response,
        }


@dataclass(slots=True)
class ActorRecord:
    """Minimal actor reference used by relationship analysis."""

    cast_id: str
    display_name: str


@dataclass(slots=True)
class AdoptedActivityRecord:
    """Normalized activity extracted from `round_actions_adopted`."""

    round_index: int
    source_cast_id: str
    target_cast_ids: list[str]
    visibility: str
    thread_id: str
    action_type: str = ""
    goal: str = ""
    summary: str = ""
    detail: str = ""
    utterance: str = ""


@dataclass(slots=True)
class LoadedRunAnalysis:
    """Loaded analyzer input data for one run."""

    run_id: str
    source_path: Path
    event_count: int
    llm_calls: list[LLMCallRecord]
    actors_by_id: dict[str, ActorRecord]
    adopted_activities: list[AdoptedActivityRecord]
    has_actors_finalized_event: bool
    has_round_actions_adopted_event: bool
    planned_actions: list["PlannedActionRecord"] = field(default_factory=list)
    planned_max_rounds: int = 0
    has_plan_finalized_event: bool = False

    @property
    def roles(self) -> list[str]:
        return sorted({record.role for record in self.llm_calls})


@dataclass(slots=True)
class NumericSummary:
    """Compact numeric summary for one metric series."""

    count: int
    min_value: float | None
    max_value: float | None
    mean_value: float | None
    median_value: float | None
    p90_value: float | None
    p95_value: float | None
    p99_value: float | None

    def to_dict(self) -> dict[str, object]:
        return {
            "count": self.count,
            "min": self.min_value,
            "max": self.max_value,
            "mean": self.mean_value,
            "median": self.median_value,
            "p90": self.p90_value,
            "p95": self.p95_value,
            "p99": self.p99_value,
        }

    def to_flat_dict(self, *, prefix: str) -> dict[str, object]:
        return {
            f"{prefix}_count": self.count,
            f"{prefix}_min": self.min_value,
            f"{prefix}_max": self.max_value,
            f"{prefix}_mean": self.mean_value,
            f"{prefix}_median": self.median_value,
            f"{prefix}_p90": self.p90_value,
            f"{prefix}_p95": self.p95_value,
            f"{prefix}_p99": self.p99_value,
        }


@dataclass(slots=True)
class MetricDistribution:
    """Serializable metric distribution artifact."""

    metric: str
    record_count: int
    sample_count: int
    missing_count: int
    min_value: float | None
    max_value: float | None
    mean_value: float | None
    median_value: float | None
    p90_value: float | None
    p95_value: float | None
    p99_value: float | None
    histogram_bin_edges: list[float] = field(default_factory=list)
    histogram_counts: list[int] = field(default_factory=list)
    kde_x: list[float] = field(default_factory=list)
    kde_y: list[float] = field(default_factory=list)
    kde_skipped_reason: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "metric": self.metric,
            "metric_label": metric_label(self.metric),
            "record_count": self.record_count,
            "sample_count": self.sample_count,
            "missing_count": self.missing_count,
            "min": self.min_value,
            "max": self.max_value,
            "mean": self.mean_value,
            "median": self.median_value,
            "p90": self.p90_value,
            "p95": self.p95_value,
            "p99": self.p99_value,
            "histogram_bin_edges": self.histogram_bin_edges,
            "histogram_counts": self.histogram_counts,
            "kde_x": self.kde_x,
            "kde_y": self.kde_y,
            "kde_skipped_reason": self.kde_skipped_reason,
        }
