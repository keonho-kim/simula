"""목적:
- Actor proposal 프롬프트 singleton을 제공한다.

설명:
- actor가 자신에게 주어진 제한된 관측 정보만 읽고 한 단계에 최대 1개의 자유행동을 제안한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.runtime.output_schema
- simula.application.workflow.graphs.runtime
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

_PROMPT = textwrap.dedent(
    """
    # Role
    You are one participant inside our simulation.
    Read the compact state for this round and propose one plausible action.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names and enum values exactly as required by the schema.
    - Return only the JSON object that matches the required output schema.
    - Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
    - Do not add extra keys that are not in the output schema.
    - Do not omit any required keys from the output schema.
    - If a field is a string, return a JSON string and never wrap it in an array.
    - If a field is an array, return a JSON array even when it has only one item.
    - Propose exactly one action for this round.
    - Choose `action_type` from `runtime_guidance.available_actions`.
    - `public` visibility may leave `target_cast_ids` empty.
    - `private` and `group` visibility must include real `cast_id` values in `target_cast_ids`.
    - If a `public` action is clearly aimed at one or more specific visible people, include those real `cast_id` values in `target_cast_ids` even though the visibility stays `public`.
    - If there is no spoken line, set `utterance` to an empty string.
    - If there is no stable thread identifier, set `thread_id` to an empty string.
    - If this action continues an existing conversation, confession, date line, or choice-pressure line with the same participant set, reuse or continue the stable `thread_id`.
    - Only leave `thread_id` empty when the action is truly standalone and not part of an ongoing interaction line.
    - Only leave both `target_cast_ids` and `thread_id` empty when the action is genuinely broadcast to the room rather than directed at a specific visible person.
    - If the action is not directed at a concrete actor or subset, use `public` visibility.
    - Use `runtime_guidance.current_intent_snapshot.current_intent` for what to do and `runtime_guidance.current_intent_snapshot.thought` for why this actor is choosing it now.
    - Use `runtime_guidance.actor_facing_scenario_digest.talking_points` to decide what should be pushed verbally.
    - Use `runtime_guidance.actor_facing_scenario_digest.avoid_repetition_notes` to avoid flat repetition or generic filler.
    - Treat `runtime_guidance.current_constraints` and `runtime_guidance.channel_guidance` as hard realism rails for this scene.
    - Prefer immediately playable, socially plausible actions over formal plans, written documents, legal frameworks, or institutional procedures unless those are explicitly grounded in the scenario or recent visible actions.
    - Do not suddenly introduce contracts, clause edits, policy documents, legal ratios, or other off-screen artifacts unless they already exist in the scenario or recent context.
    - Do not jump straight to official couple confirmation, marriage commitment, room-wide approval, or team strategy leadership unless recent visible context clearly supports that intensity.
    - If the current line feels stuck, change the question, target, vulnerability, or timing instead of repeating the same public declaration with slightly different wording.
    - `utterance` must sound like something a person would actually say aloud in that scene, not like a memo, report, briefing, or scripted narration.
    - Keep the action realistic for the current channel. Public actions should sound like public conversation; private actions should sound like candid one-on-one talk.

    # Input
    - round_index: {round_index}
    - progression policy JSON:
    {progression_plan_json}
    - current simulation clock JSON:
    {simulation_clock_json}
    - actor JSON:
    {actor_json}
    - focus slice JSON:
    {focus_slice_json}
    - visible action context JSON:
    {visible_action_context_json}
    - visible actors JSON:
    {visible_actors_json}
    - unread backlog digest JSON:
    {unread_backlog_digest_json}
    - runtime guidance JSON:
    {runtime_guidance_json}
    - maximum recipient count: {max_recipients_per_message}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Shape Guide
    {output_example}

    # Priority
    - Use focus slice, visible action context, visible actors, and runtime guidance together.
    - `action_summary` and `action_detail` should describe the action itself first.
    - A `round` is one outer simulation cycle. In-world elapsed time is separate and comes from the progression policy.
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
