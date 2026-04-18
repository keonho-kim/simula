"""Final reporting contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class LLMUsageSummary(BaseModel):
    """Run-scoped LLM usage summary."""

    total_calls: int
    calls_by_role: dict[str, int]
    calls_by_task: dict[str, int] = Field(default_factory=dict)
    structured_calls: int
    text_calls: int
    parse_failures: int
    forced_defaults: int
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None


class FinalReport(BaseModel):
    """Final aggregate report."""

    run_id: str
    scenario: str
    objective: str
    world_summary: str
    world_state_summary: str
    elapsed_simulation_minutes: int
    elapsed_simulation_label: str
    rounds_completed: int
    actor_count: int
    total_activities: int
    visibility_activity_counts: dict[str, int]
    last_observer_summary: str
    notable_events: list[str]
    errors: list[str]
    llm_usage_summary: LLMUsageSummary


class TimelineAnchorDecision(BaseModel):
    """Absolute timeline anchor."""

    anchor_iso: str
    reason: str

    @model_validator(mode="after")
    def validate_timeline_anchor(self) -> "TimelineAnchorDecision":
        if not self.anchor_iso.strip():
            raise ValueError("anchor_iso must not be empty.")
        if not self.reason.strip():
            raise ValueError("reason must not be empty.")
        return self
