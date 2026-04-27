"""Current-runtime scene delta prompt."""

from __future__ import annotations

from textwrap import dedent

from langchain_core.prompts import PromptTemplate

SCENE_DELTA_EXAMPLE: dict[str, object] = {
    "selected_event_id": "<copy the selected event_id>",
    "scene_beats": [
        {
            "beat_id": "B1",
            "candidate_id": "<candidate_id from candidate_table>",
            "source_cast_id": "<candidate source_cast_id>",
            "target_cast_ids": ["<candidate target cast_id>"],
            "intent": "<why this actor acts now>",
            "action_type": "<candidate action_type>",
            "summary": "<compact actor action summary>",
            "detail": "<concrete beat detail>",
            "utterance": "<spoken Korean line or empty string>",
            "reaction": "<target or room reaction>",
            "emotional_tone": "<short tone label>",
            "event_effect": "<event-memory-safe effect>",
        }
    ],
    "intent_updates": [
        {
            "cast_id": "<actor cast_id>",
            "goal": "<updated compact goal>",
            "target_cast_ids": ["<target cast_id>"],
            "confidence": 0.75,
            "changed_from_previous": True,
        }
    ],
    "event_updates": [
        {
            "event_id": "<selected event_id>",
            "status": "<pending, in_progress, completed, or missed>",
            "progress_summary": "<compact event progress>",
            "matched_activity_ids": [
                "<activity_id from scene beats, or return [] when none>"
            ],
        }
    ],
    "world_state_summary": "<one compact Korean sentence>",
    "time_advance": {
        "elapsed_unit": "minute",
        "elapsed_amount": 30,
        "reason": "<why this much time passed>",
    },
    "stop_reason": "<empty string or simulation_done>",
    "debug_rationale": "<brief rationale for scene beats>",
}

_PROMPT = dedent("""# Role
You write the next scene beat delta.

# Goal
Use the agent states and candidate table to dramatize concrete beats inside the current scene. Do not invent actions, actors, events, or ids.

# Rules
- selected_event_id must copy compact_input.selected_event.event_id.
- scene_beats must contain only candidate_id values from compact_input.candidates.
- Do not exceed compact_input.runtime_budget.max_scene_beats.
- scene_beats[*].source_cast_id, target_cast_ids, and action_type must match the selected candidate.
- intent must use the selected candidate's intent/stakes/risk and explain why that actor acts now.
- summary and detail describe the actor's concrete action, not an abstract outcome.
- Use each scene actor's voice field when writing spoken utterance.
- utterance should be natural Korean when the beat is spoken; use "" only for non-verbal or internal action.
- reaction describes how targets or the room respond.
- event_effect describes only a change that can be stored in event memory.
- intent_updates may update only scene actor cast_id values and should reflect how the beat changes each actor's next goal.
- event_updates may update only the selected event.
- event_updates[*].matched_activity_ids is required; return [] when there is no known activity_id, but never omit the key.
- world_state_summary must be one compact Korean sentence.
- stop_reason must be "" or "simulation_done".
- debug_rationale should explain why these beats best move the event.

# Output schema
{format_rules}

# Example
{output_example}

# Compact input
{compact_input_json}
""".strip())

PROMPT = PromptTemplate.from_template(_PROMPT)
