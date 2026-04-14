"""Purpose:
- Provide local semantic normalization helpers for actor proposals.

Description:
- Infer missing targets from explicit name mentions or current intent.
- Reuse or synthesize stable thread identifiers for targeted actions.
"""

from __future__ import annotations

from collections.abc import Iterable

from simula.domain.contracts import ActorActionProposal

_INTERPERSONAL_KEYWORDS = (
    "질문",
    "물어",
    "묻",
    "확인",
    "고백",
    "데이트",
    "대화",
    "이야기",
    "제안",
    "선택",
    "관계",
    "감정",
)


def normalize_actor_action_proposal(
    *,
    proposal: ActorActionProposal,
    source_cast_id: str,
    visible_actors: list[dict[str, object]],
    visible_action_context: list[dict[str, object]],
    current_intent_snapshot: dict[str, object],
) -> ActorActionProposal:
    """Normalize one actor proposal with local target/thread inference."""

    normalized_target_cast_ids = _sanitize_ordered_unique(
        proposal.target_cast_ids,
        valid_target_cast_ids=_valid_visible_target_cast_ids(
            source_cast_id=source_cast_id,
            visible_actors=visible_actors,
        ),
    )
    if not normalized_target_cast_ids:
        normalized_target_cast_ids = infer_target_cast_ids(
            proposal=proposal,
            source_cast_id=source_cast_id,
            visible_actors=visible_actors,
            current_intent_snapshot=current_intent_snapshot,
        )

    normalized_intent_target_cast_ids = _sanitize_ordered_unique(
        proposal.intent_target_cast_ids,
        valid_target_cast_ids=_valid_visible_target_cast_ids(
            source_cast_id=source_cast_id,
            visible_actors=visible_actors,
        ),
    )
    if not normalized_intent_target_cast_ids and normalized_target_cast_ids:
        normalized_intent_target_cast_ids = list(normalized_target_cast_ids)

    thread_id = proposal.thread_id.strip()
    if not thread_id and normalized_target_cast_ids:
        thread_id = infer_thread_id(
            proposal=proposal,
            source_cast_id=source_cast_id,
            target_cast_ids=normalized_target_cast_ids,
            visible_action_context=visible_action_context,
        )

    return ActorActionProposal(
        action_type=proposal.action_type,
        intent=proposal.intent,
        intent_target_cast_ids=normalized_intent_target_cast_ids,
        action_summary=proposal.action_summary,
        action_detail=proposal.action_detail,
        utterance=proposal.utterance,
        visibility=proposal.visibility,
        target_cast_ids=normalized_target_cast_ids,
        thread_id=thread_id,
    )


def infer_target_cast_ids(
    *,
    proposal: ActorActionProposal,
    source_cast_id: str,
    visible_actors: list[dict[str, object]],
    current_intent_snapshot: dict[str, object],
) -> list[str]:
    """Infer missing targets from explicit mentions or current intent."""

    valid_target_cast_ids = _valid_visible_target_cast_ids(
        source_cast_id=source_cast_id,
        visible_actors=visible_actors,
    )
    explicitly_named = _infer_explicit_mentions(
        proposal=proposal,
        visible_actors=visible_actors,
        source_cast_id=source_cast_id,
    )
    if explicitly_named:
        return _sanitize_ordered_unique(
            explicitly_named,
            valid_target_cast_ids=valid_target_cast_ids,
        )

    current_intent_targets = _sanitize_ordered_unique(
        _string_list(current_intent_snapshot.get("target_cast_ids", [])),
        valid_target_cast_ids=valid_target_cast_ids,
    )
    if (
        len(current_intent_targets) == 1
        and _looks_interpersonal_action(proposal=proposal)
    ):
        return current_intent_targets
    return []


def infer_thread_id(
    *,
    proposal: ActorActionProposal,
    source_cast_id: str,
    target_cast_ids: list[str],
    visible_action_context: list[dict[str, object]],
) -> str:
    """Infer a stable thread identifier for a targeted action."""

    if not target_cast_ids:
        return ""

    current_family = classify_thread_family(proposal.action_type)
    current_participants = _participant_key(source_cast_id, target_cast_ids)
    for action in visible_action_context:
        thread_id = str(action.get("thread_id", "")).strip()
        if not thread_id:
            continue
        action_family = classify_thread_family(str(action.get("action_type", "")))
        action_participants = _participant_key(
            str(action.get("source_cast_id", "")),
            _string_list(action.get("target_cast_ids", [])),
        )
        if action_participants == current_participants and action_family == current_family:
            return thread_id

    scope = "pair" if len(current_participants) == 2 else "group"
    return f"{scope}:{'+'.join(current_participants)}:{current_family}"


def classify_thread_family(action_type: str) -> str:
    """Collapse raw action types into a stable thread family."""

    lowered = action_type.strip().lower()
    if "date" in lowered:
        return "date_selection"
    if "confide" in lowered or "confession" in lowered:
        return "private_confession"
    if "choice" in lowered or "choose" in lowered:
        return "choice_pressure"
    if (
        "conversation" in lowered
        or "dialogue" in lowered
        or "discussion" in lowered
        or "speech" in lowered
        or "statement" in lowered
    ):
        return "public_conversation"
    return lowered or "interaction"


def _infer_explicit_mentions(
    *,
    proposal: ActorActionProposal,
    visible_actors: list[dict[str, object]],
    source_cast_id: str,
) -> list[str]:
    combined_text = "\n".join(
        [
            proposal.intent,
            proposal.action_summary,
            proposal.action_detail,
            proposal.utterance,
        ]
    )
    matches: list[str] = []
    for actor in visible_actors:
        cast_id = str(actor.get("cast_id", "")).strip()
        display_name = str(actor.get("display_name", "")).strip()
        if not cast_id or cast_id == source_cast_id or not display_name:
            continue
        if display_name in combined_text and cast_id not in matches:
            matches.append(cast_id)
    return matches


def _looks_interpersonal_action(*, proposal: ActorActionProposal) -> bool:
    lowered_action_type = proposal.action_type.strip().lower()
    if any(
        token in lowered_action_type
        for token in ("date", "confide", "confession", "dialogue", "conversation")
    ):
        return True
    combined_text = " ".join(
        [
            proposal.intent,
            proposal.action_summary,
            proposal.action_detail,
            proposal.utterance,
        ]
    )
    return any(keyword in combined_text for keyword in _INTERPERSONAL_KEYWORDS)


def _valid_visible_target_cast_ids(
    *,
    source_cast_id: str,
    visible_actors: list[dict[str, object]],
) -> list[str]:
    return [
        str(actor.get("cast_id", "")).strip()
        for actor in visible_actors
        if str(actor.get("cast_id", "")).strip()
        and str(actor.get("cast_id", "")).strip() != source_cast_id
    ]


def _sanitize_ordered_unique(
    values: Iterable[str],
    *,
    valid_target_cast_ids: list[str],
) -> list[str]:
    valid_set = set(valid_target_cast_ids)
    ordered: list[str] = []
    for value in values:
        cast_id = str(value).strip()
        if cast_id not in valid_set or cast_id in ordered:
            continue
        ordered.append(cast_id)
    return ordered


def _participant_key(source_cast_id: str, target_cast_ids: list[str]) -> tuple[str, ...]:
    participants = {source_cast_id.strip(), *[cast_id.strip() for cast_id in target_cast_ids]}
    return tuple(sorted(item for item in participants if item))


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]
