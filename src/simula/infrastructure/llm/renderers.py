"""목적:
- 구조화 LLM 응답을 사람이 읽기 좋은 로그 텍스트로 변환한다.

설명:
- schema별 핵심 정보를 뽑아 CLI에서 읽기 쉬운 요약 로그를 만든다.

사용한 설계 패턴:
- renderer 유틸 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.router
- simula.domain.contracts
"""

from __future__ import annotations

from pydantic import BaseModel

from simula.domain.contracts import (
    ActionCatalog,
    ActorFacingScenarioDigest,
    ActorActionProposal,
    ActorCard,
    ActorIntentStateBatch,
    BackgroundUpdateBatch,
    CastRoster,
    CoordinationFrame,
    ObserverReport,
    ExecutionPlanBundle,
    FinalReportSections,
    PlanningAnalysis,
    RuntimeProgressionPlan,
    ScenarioTimeScope,
    SimulationClockSnapshot,
    RoundDirective,
    RoundResolution,
    RoundTimeAdvanceProposal,
    SituationBundle,
)
from simula.domain.time_units import duration_label


def render_structured_response(
    *,
    role: str,
    parsed: BaseModel | None,
    content: str,
    log_context: dict[str, object] | None,
) -> str:
    """구조화 응답을 사람이 읽기 좋은 로그 텍스트로 변환한다."""

    if parsed is None:
        if not content.strip():
            return f"{role} 응답이 비어 있습니다."
        return f"{role} 응답을 구조적으로 해석하지 못했습니다. 원문 요약: {_truncate(content.strip(), 220)}"

    if isinstance(parsed, PlanningAnalysis):
        pressures = ", ".join(parsed.key_pressures[:2]) or "-"
        return (
            f"계획 분석을 완료했습니다.\n"
            f"요약: {parsed.brief_summary}\n"
            f"전제: {parsed.premise}\n"
            f"시간 범위: {parsed.time_scope.start} -> {parsed.time_scope.end}\n"
            f"추천 round 수: {parsed.progression_plan.max_rounds}\n"
            f"기본 시간 단위: {parsed.progression_plan.default_elapsed_unit}\n"
            f"허용 시간 단위: {', '.join(parsed.progression_plan.allowed_elapsed_units)}\n"
            f"공개 맥락 {len(parsed.public_context)}개 / 비공개 맥락 {len(parsed.private_context)}개\n"
            f"중요 변수: {pressures}"
        )

    if isinstance(parsed, ScenarioTimeScope):
        return f"시간 범위를 해석했습니다.\n시작: {parsed.start}\n종료: {parsed.end}"

    if isinstance(parsed, RuntimeProgressionPlan):
        return (
            "실행 시간 진행 계획을 정했습니다.\n"
            f"허용 시간 단위: {', '.join(parsed.allowed_elapsed_units)}\n"
            f"기본 시간 단위: {parsed.default_elapsed_unit}\n"
            f"추천 round 수: {parsed.max_rounds}\n"
            f"이유: {parsed.selection_reason}"
        )

    if isinstance(parsed, RoundTimeAdvanceProposal):
        return (
            "round 경과 시간을 추정했습니다.\n"
            f"이번 round 경과: {duration_label(time_unit=parsed.elapsed_unit, amount=parsed.elapsed_amount)}\n"
            f"이유: {parsed.selection_reason}"
        )

    if isinstance(parsed, SimulationClockSnapshot):
        return (
            "시뮬레이션 clock 상태를 갱신했습니다.\n"
            f"누적 시간: {parsed.total_elapsed_label}\n"
            f"직전 round 경과: {parsed.last_elapsed_label}"
        )

    if isinstance(parsed, SituationBundle):
        tensions = ", ".join(parsed.initial_tensions[:2]) or "-"
        return (
            f"실행에 필요한 상황을 정리했습니다.\n"
            f"시뮬레이션 목표: {parsed.simulation_objective}\n"
            f"세계 요약: {parsed.world_summary}\n"
            f"처음 갈등: {tensions}"
        )

    if isinstance(parsed, ExecutionPlanBundle):
        action_types = ", ".join(
            item.action_type for item in parsed.action_catalog.actions[:5]
        ) or "-"
        return (
            "실행 계획 번들을 만들었습니다.\n"
            f"action 수: {len(parsed.action_catalog.actions)}\n"
            f"cast 수: {len(parsed.cast_roster.items)}\n"
            f"대표 action_type: {action_types}\n"
            f"세계 요약: {_truncate(parsed.situation.world_summary, 140)}"
        )

    if isinstance(parsed, CoordinationFrame):
        return (
            "round 조율 기준 프레임을 만들었습니다.\n"
            f"focus 규칙: {_list_preview(parsed.focus_selection_rules, limit=2)}\n"
            f"배경 규칙: {_list_preview(parsed.background_motion_rules, limit=2)}"
        )

    if isinstance(parsed, ActionCatalog):
        action_types = ", ".join(item.action_type for item in parsed.actions[:4]) or "-"
        return (
            "시나리오 공통 action catalog를 만들었습니다.\n"
            f"action 수: {len(parsed.actions)}\n"
            f"대표 action_type: {action_types}"
        )

    if isinstance(parsed, CastRoster):
        names = ", ".join(item.display_name for item in parsed.items[:6]) or "-"
        return (
            f"등장 주체 {len(parsed.items)}명을 확정했습니다.\n"
            f"인물: {names}"
        )

    if isinstance(parsed, ActorCard):
        group_name = parsed.group_name or "무소속"
        return (
            f"{parsed.display_name} 역할 카드를 만들었습니다.\n"
            f"역할: {parsed.role} / 소속: {group_name or '미지정'} / attention: {parsed.baseline_attention_tier}\n"
            f"공개 성향: {_truncate(parsed.public_profile, 120)}"
        )

    if isinstance(parsed, RoundDirective):
        slice_titles = ", ".join(
            focus_slice.title for focus_slice in parsed.focus_slices[:2]
        ) or "-"
        return (
            "round 지시를 정했습니다.\n"
            f"선택 actor: {len(parsed.selected_actor_ids)}명 / slice: {len(parsed.focus_slices)}개\n"
            f"요약: {_truncate(parsed.focus_summary, 140)}\n"
            f"slice 제목: {slice_titles}\n"
            f"선택 이유: {_truncate(parsed.selection_reason, 140)}"
        )

    if isinstance(parsed, BackgroundUpdateBatch):
        return (
            "배경 상태 변화를 정리했습니다.\n"
            f"update 수: {len(parsed.background_updates)}건"
        )

    if isinstance(parsed, ActorActionProposal):
        actor_name = _actor_name(log_context)
        targets = _target_description(parsed.target_actor_ids)
        thought = _actor_thought(log_context)
        talking_points = _actor_talking_points(log_context)
        recommended_tone = _actor_recommended_tone(log_context)
        thought_line = (
            f"\n판단 이유: {_truncate(thought, 140)}" if thought.strip() else ""
        )
        talking_points_line = (
            f"\n말 포인트 참고: {_list_preview(talking_points, limit=2)}"
            if talking_points
            else ""
        )
        tone_line = (
            f"\n권장 톤: {_truncate(recommended_tone, 80)}"
            if recommended_tone.strip()
            else ""
        )
        utterance_line = (
            f"\n발화: {_truncate(parsed.utterance, 120)}"
            if parsed.utterance.strip()
            else ""
        )
        return (
            f"{actor_name}{_subject_particle(actor_name)} {_visibility_label(parsed.visibility)}을 제안했습니다.\n"
            f"action_type: {parsed.action_type}\n"
            f"의도: {parsed.intent}\n"
            f"대상: {targets}\n"
            f"액션: {parsed.action_summary}\n"
            f"내용: {_truncate(parsed.action_detail, 180)}"
            f"{thought_line}"
            f"{talking_points_line}"
            f"{tone_line}"
            f"{utterance_line}"
        )

    if isinstance(parsed, ActorIntentStateBatch):
        changed = sum(
            1 for item in parsed.actor_intent_states if item.changed_from_previous
        )
        thought_preview = ", ".join(
            _truncate(item.thought, 40) for item in parsed.actor_intent_states[:2]
        ) or "-"
        return (
            "actor intent 상태를 갱신했습니다.\n"
            f"actor 수: {len(parsed.actor_intent_states)}\n"
            f"변경된 intent: {changed}명\n"
            f"판단 이유 예시: {thought_preview}"
        )

    if isinstance(parsed, ActorFacingScenarioDigest):
        return (
            "다음 round용 actor-facing digest를 정리했습니다.\n"
            f"관계 판도: {_truncate(parsed.relationship_map_summary, 120)}\n"
            f"현재 압력: {_list_preview(parsed.current_pressures, limit=2)}\n"
            f"말 포인트: {_list_preview(parsed.talking_points, limit=2)}\n"
            f"반복 금지: {_list_preview(parsed.avoid_repetition_notes, limit=2)}\n"
            f"권장 톤: {_truncate(parsed.recommended_tone, 80)}"
        )

    if isinstance(parsed, ObserverReport):
        events = ", ".join(parsed.notable_events[:3]) or "-"
        return (
            f"관찰 요약을 정리했습니다.\n"
            f"시간 시점: {_elapsed_label(log_context, parsed.round_index)}\n"
            f"분위기: {parsed.atmosphere} / 흐름 속도: {_momentum_text(parsed.momentum)}({parsed.momentum})\n"
            f"요약: {parsed.summary}\n"
            f"주요 사건: {events}\n"
            f"세계 상태: {_truncate(parsed.world_state_summary, 160)}"
        )

    if isinstance(parsed, RoundResolution):
        digest = parsed.actor_facing_scenario_digest
        thought_preview = ", ".join(
            _truncate(item.thought, 50) for item in parsed.updated_intent_states[:2]
        ) or "-"
        return (
            "round 해소 결과를 정리했습니다.\n"
            f"채택 actor: {len(parsed.adopted_actor_ids)}명\n"
            f"세계 상태: {_truncate(parsed.world_state_summary, 140)}\n"
            f"관계 판도: {_truncate(digest.relationship_map_summary, 120)}\n"
            f"현재 압력: {_list_preview(digest.current_pressures, limit=2)}\n"
            f"말 포인트: {_list_preview(digest.talking_points, limit=2)}\n"
            f"반복 금지: {_list_preview(digest.avoid_repetition_notes, limit=2)}\n"
            f"권장 톤: {_truncate(digest.recommended_tone, 80)}\n"
            f"판단 이유 예시: {thought_preview}"
        )

    if isinstance(parsed, FinalReportSections):
        return (
            "최종 보고서 번들을 작성했습니다.\n"
            f"타임라인 줄 수: {len([line for line in parsed.timeline_section.splitlines() if line.strip()])}\n"
            f"주요 사건 줄 수: {len([line for line in parsed.major_events_section.splitlines() if line.strip()])}"
        )

    if isinstance(parsed, BaseModel):
        dumped = parsed.model_dump(mode="json")
        if isinstance(dumped, dict):
            keys = ", ".join(str(key) for key in list(dumped.keys())[:6]) or "-"
            return f"{role} 응답을 해석했습니다.\n필드: {keys}"
    return f"{role} 응답을 해석했습니다."


def render_text_response(
    *,
    role: str,
    content: str,
    log_context: dict[str, object] | None,
) -> str:
    """원문 LLM 응답을 사람이 읽기 좋은 로그 텍스트로 변환한다."""

    stripped = content.strip()
    scope = str(log_context.get("scope")) if log_context else ""
    if role == "planner" and scope == "interpretation-core":
        return f"시나리오 핵심 전제를 정리했습니다.\n전제: {stripped}"
    if role == "planner" and scope == "cast_roster":
        names = _extract_ndjson_names(stripped)
        return (
            f"등장 주체 {len(names)}명을 확정했습니다.\n"
            f"인물: {', '.join(names[:6]) if names else '-'}"
        )
    if role == "fixer" and scope == "json-fix":
        return f"JSON 복구 결과를 받았습니다.\n출력: {_truncate(stripped, 220)}"
    return _truncate(stripped, 220)


def _actor_name(log_context: dict[str, object] | None) -> str:
    if not log_context:
        return "actor"
    display_name = log_context.get("actor_display_name")
    if display_name is not None:
        return str(display_name)
    actor_id = log_context.get("actor_id")
    if actor_id is not None:
        return str(actor_id)
    return "actor"


def _actor_thought(log_context: dict[str, object] | None) -> str:
    if not log_context:
        return ""
    thought = log_context.get("actor_thought")
    if thought is None:
        return ""
    return str(thought)


def _actor_talking_points(log_context: dict[str, object] | None) -> list[str]:
    if not log_context:
        return []
    value = log_context.get("actor_talking_points")
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _actor_recommended_tone(log_context: dict[str, object] | None) -> str:
    if not log_context:
        return ""
    tone = log_context.get("actor_recommended_tone")
    if tone is None:
        return ""
    return str(tone)


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _list_preview(value: object, *, limit: int) -> str:
    if not isinstance(value, list):
        return "-"
    items = [str(item) for item in value[:limit]]
    return ", ".join(items) if items else "-"


def _extract_ndjson_names(content: str) -> list[str]:
    names: list[str] = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        name_key = '"display_name":"'
        if name_key not in stripped:
            continue
        start = stripped.index(name_key) + len(name_key)
        end = stripped.find('"', start)
        if end != -1:
            names.append(stripped[start:end])
    return names


def _subject_particle(text: str) -> str:
    return "이" if _has_batchim(text) else "가"


def _visibility_label(visibility: str) -> str:
    labels = {
        "public": "공개 행동",
        "private": "비공개 행동",
        "group": "일부 공개 행동",
    }
    return labels.get(visibility, "행동")


def _momentum_text(momentum: str) -> str:
    labels = {
        "high": "빠름",
        "medium": "보통",
        "low": "느림",
    }
    return labels.get(momentum, momentum)


def _target_description(target_actor_ids: list[str]) -> str:
    if not target_actor_ids:
        return "전체 공개"
    return ", ".join(target_actor_ids)


def _has_batchim(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    last_char = stripped[-1]
    code = ord(last_char)
    if not (0xAC00 <= code <= 0xD7A3):
        return False
    return (code - 0xAC00) % 28 != 0


def _elapsed_label(log_context: dict[str, object] | None, round_index: int) -> str:
    if not log_context:
        return f"{round_index}단계"
    simulation_clock_label = log_context.get("simulation_clock_label")
    if isinstance(simulation_clock_label, str) and simulation_clock_label.strip():
        return simulation_clock_label
    return f"{round_index}단계"
