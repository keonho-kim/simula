"""Generation-stage contracts."""

from __future__ import annotations

from pydantic import BaseModel, model_validator

from simula.domain.contracts.shared import AttentionTier


class ActorCard(BaseModel):
    """Runtime actor card."""

    cast_id: str
    display_name: str
    role: str
    group_name: str
    public_profile: str
    private_goal: str
    speaking_style: str
    avatar_seed: str
    baseline_attention_tier: AttentionTier
    story_function: str
    preferred_action_types: list[str]
    action_bias_notes: list[str]

    @model_validator(mode="after")
    def validate_actor_card(self) -> "ActorCard":
        for field_name in (
            "cast_id",
            "display_name",
            "role",
            "public_profile",
            "private_goal",
            "speaking_style",
            "avatar_seed",
            "story_function",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class GeneratedActorCardDraft(BaseModel):
    """LLM draft for one actor card without identity fields."""

    role: str
    public_profile: str
    private_goal: str
    speaking_style: str
    avatar_seed: str
    baseline_attention_tier: AttentionTier
    story_function: str
    preferred_action_types: list[str]
    action_bias_notes: list[str]

    @model_validator(mode="after")
    def validate_generated_actor_card_draft(self) -> "GeneratedActorCardDraft":
        for field_name in (
            "role",
            "public_profile",
            "private_goal",
            "speaking_style",
            "avatar_seed",
            "story_function",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self
