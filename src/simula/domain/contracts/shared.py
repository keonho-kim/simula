"""Shared contract literals and cross-stage time models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from simula.domain.scenario.time import TimeUnit

VisibilityType = Literal["public", "private", "group"]
SimulationMomentum = Literal["high", "medium", "low"]
AttentionTier = Literal["lead", "driver", "support", "background"]
PressureLevel = Literal["low", "medium", "high"]
MajorEventStatusType = Literal["pending", "in_progress", "completed", "missed"]
StopReason = Literal["", "no_progress", "simulation_done"]
ContinuationStopReason = Literal["", "no_progress"]
ResolutionStopReason = Literal["", "simulation_done"]


class ScenarioTimeScope(BaseModel):
    """Scenario time window."""

    start: str
    end: str

    @model_validator(mode="after")
    def validate_time_scope(self) -> "ScenarioTimeScope":
        if not self.start.strip():
            raise ValueError("start must not be empty.")
        if not self.end.strip():
            raise ValueError("end must not be empty.")
        return self


class RuntimeProgressionPlan(BaseModel):
    """Runtime pacing policy."""

    max_rounds: int = Field(ge=1)
    allowed_elapsed_units: list[TimeUnit]
    default_elapsed_unit: TimeUnit
    reason: str

    @model_validator(mode="after")
    def validate_progression_plan(self) -> "RuntimeProgressionPlan":
        if not self.allowed_elapsed_units:
            raise ValueError("allowed_elapsed_units must not be empty.")
        if len(self.allowed_elapsed_units) != len(set(self.allowed_elapsed_units)):
            raise ValueError("allowed_elapsed_units must be unique.")
        if self.default_elapsed_unit not in self.allowed_elapsed_units:
            raise ValueError("default_elapsed_unit must be included in allowed_elapsed_units.")
        if not self.reason.strip():
            raise ValueError("reason must not be empty.")
        return self


class RoundTimeAdvanceProposal(BaseModel):
    """Elapsed time chosen for one step."""

    elapsed_unit: TimeUnit
    elapsed_amount: int = Field(ge=1)
    reason: str

    @model_validator(mode="after")
    def validate_time_advance(self) -> "RoundTimeAdvanceProposal":
        if not self.reason.strip():
            raise ValueError("reason must not be empty.")
        return self


class RoundTimeAdvanceRecord(BaseModel):
    """Persisted normalized step-time record."""

    round_index: int = Field(ge=1)
    elapsed_unit: TimeUnit
    elapsed_amount: int = Field(ge=1)
    elapsed_minutes: int = Field(ge=1)
    elapsed_label: str
    total_elapsed_minutes: int = Field(ge=0)
    total_elapsed_label: str
    reason: str


class SimulationClockSnapshot(BaseModel):
    """Accumulated simulation clock snapshot."""

    total_elapsed_minutes: int = Field(ge=0)
    total_elapsed_label: str
    last_elapsed_minutes: int = Field(ge=0)
    last_elapsed_label: str
    last_advanced_round_index: int = Field(ge=0)
