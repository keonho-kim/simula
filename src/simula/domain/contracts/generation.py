"""Generation-stage contracts."""

from __future__ import annotations

from pydantic import BaseModel, model_validator


class ActorCard(BaseModel):
    """Runtime actor card."""

    cast_id: str
    display_name: str
    role: str
    narrative_profile: str
    private_goal: str
    voice: str
    preferred_action_types: list[str]

    @model_validator(mode="after")
    def validate_actor_card(self) -> "ActorCard":
        for field_name in (
            "cast_id",
            "display_name",
            "role",
            "narrative_profile",
            "private_goal",
            "voice",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class ActorRosterBundle(BaseModel):
    """Bundled actor-card generation result."""

    actors: list[ActorCard]

    @model_validator(mode="after")
    def validate_actor_roster_bundle(self) -> "ActorRosterBundle":
        if not self.actors:
            raise ValueError("actors must not be empty.")
        cast_ids = [actor.cast_id for actor in self.actors]
        display_names = [actor.display_name for actor in self.actors]
        if len(cast_ids) != len(set(cast_ids)):
            raise ValueError("actors must use unique cast_id values.")
        if len(display_names) != len(set(display_names)):
            raise ValueError("actors must use unique display_name values.")
        return self
