"""목적:
- 구조화 응답 예시와 공용 형식 지시문을 관리한다.

설명:
- 프롬프트 파일마다 반복하지 않고, 반환 타입 예시를 중앙에서 생성한다.

사용한 설계 패턴:
- 공용 프롬프트 자산 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.output_parsers
- simula.application.workflow.graphs
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel


def build_output_prompt_bundle(schema: type[BaseModel]) -> dict[str, str]:
    """프롬프트에 주입할 공용 JSON 출력 예시 묶음을 만든다."""

    example = _example_payload(schema)
    return {
        "output_format_name": "JSON",
        "format_rules": "\n".join(
            [
                "- Return one JSON object only.",
                "- Do not add code fences, explanations, or extra commentary.",
                "- Keep every string key explicitly wrapped in double quotes.",
            ]
        ),
        "output_example": json.dumps(example, ensure_ascii=False, indent=2),
    }


def build_ndjson_prompt_bundle(schema: type[BaseModel]) -> dict[str, str]:
    """프롬프트에 주입할 NDJSON 출력 예시 묶음을 만든다."""

    example = json.dumps(_example_payload(schema), ensure_ascii=False)
    return {
        "output_format_name": "NDJSON",
        "format_rules": "\n".join(
            [
                "- Return one JSON object per line.",
                "- Do not wrap the lines in a JSON array.",
                "- Do not add code fences, explanations, or blank lines.",
                "- Keep every string key explicitly wrapped in double quotes.",
            ]
        ),
        "output_example": "\n".join(
            [example, example.replace("cast-operations", "cast-finance")]
        ),
    }


def _example_payload(schema: type[BaseModel]) -> dict[str, Any]:
    examples: dict[str, dict[str, Any]] = {
        "ScenarioInterpretation": {
            "premise": "제한된 시간 안에 공개 행동과 숨은 판단이 함께 움직이는 상황이다.",
            "time_scope": {
                "start": "초기 대면 직후",
                "end": "핵심 선택 직전",
            },
            "public_context": [
                "겉으로는 신중한 태도가 이어진다.",
                "짧은 공개 행동 하나가 분위기를 바꿀 수 있다.",
            ],
            "private_context": [
                "핵심 참여자들은 속마음을 바로 드러내지 않는다.",
                "비공개 대화가 먼저 방향을 바꿀 수 있다.",
            ],
            "key_pressures": [
                "시간이 부족하다.",
                "겉으로 보이는 말과 실제 판단이 다를 수 있다.",
            ],
            "observation_points": [
                "누가 먼저 공개 신호를 보이는가",
                "누가 마지막에 한 사람으로 좁히는가",
            ],
        },
        "ScenarioTimeScope": {
            "start": "초기 대면 직후",
            "end": "핵심 선택 직전",
        },
        "RuntimeProgressionPlan": {
            "max_steps": 16,
            "allowed_units": ["minute", "hour", "day"],
            "default_unit": "hour",
            "pacing_guidance": [
                "짧은 감정 반응이나 직접 대화는 30분 또는 1시간으로 본다.",
                "입장 재정렬이나 공개 파장은 몇 시간 단위로 본다.",
                "물리 이동이나 작전 재배치는 하루 이상 점프를 허용한다.",
            ],
            "selection_reason": "이 시나리오는 짧은 반응과 긴 준비 구간이 번갈아 나오므로, 한 고정 간격보다 복수 단위를 허용해야 현실감이 살아난다.",
        },
        "StepTimeAdvanceProposal": {
            "elapsed_unit": "minute",
            "elapsed_amount": 30,
            "selection_reason": "방금 step은 직접 반응과 짧은 조율이 중심이라 반나절 이상 점프할 이유가 없다.",
            "signals": [
                "직접 발화와 즉시 반응이 중심이다.",
                "장거리 이동이나 대기 구간이 보이지 않는다.",
            ],
        },
        "SimulationClockSnapshot": {
            "total_elapsed_minutes": 390,
            "total_elapsed_label": "6시간 30분",
            "last_elapsed_minutes": 30,
            "last_elapsed_label": "30분",
            "last_advanced_step_index": 4,
        },
        "TimelineAnchorDecision": {
            "anchor_iso": "2027-06-18T03:20:00",
            "selection_reason": "시나리오에 날짜와 시작 시각이 같이 있어 그 값을 그대로 썼다.",
        },
        "VisibilityContextBundle": {
            "public_context": [
                "겉으로는 신중한 태도가 보인다.",
                "공개 신호 하나가 분위기를 바꿀 수 있다.",
            ],
            "private_context": [
                "핵심 참여자들은 속생각을 바로 드러내지 않는다.",
                "비공개 대화가 먼저 방향을 바꿀 수 있다.",
            ],
        },
        "PressurePointBundle": {
            "key_pressures": [
                "시간이 부족하다.",
                "겉으로 보이는 말과 실제 판단이 다를 수 있다.",
            ],
            "observation_points": [
                "누가 먼저 공개 신호를 보이는가",
                "누가 마지막에 한 사람으로 좁히는가",
            ],
        },
        "SituationBundle": {
            "simulation_objective": "누가 어떤 선택을 하는지 끝까지 추적한다.",
            "world_summary": "여러 actor가 같은 시간 안에서 공개 행동과 숨은 판단을 함께 이어가고 있다.",
            "initial_tensions": [
                "서로 원하는 것이 다르다.",
                "겉으로 하는 말과 실제 판단이 다를 수 있다.",
            ],
            "channel_guidance": {
                "public": "공개 채널은 분위기와 신호를 바꾸는 데 사용한다.",
                "private": "비공개 채널은 숨은 계산과 조건 조율에 사용한다.",
                "group": "그룹 채널은 여러 사람의 반응과 집단 분위기를 확인하는 데 사용한다.",
            },
            "current_constraints": [
                "시간이 제한적이다.",
                "모든 actor가 동일한 정보를 갖고 있지 않다.",
            ],
        },
        "CoordinationFrame": {
            "focus_selection_rules": [
                "직접 target이 몰린 actor와 공개 파장을 만들 수 있는 actor를 우선 본다.",
                "같은 축만 반복되지 않도록 quiet actor 유입도 고려한다.",
            ],
            "background_motion_rules": [
                "직접 충돌이 없는 준비·대기·정렬은 background update로 요약한다.",
            ],
            "focus_archetypes": [
                "직접 압박 장면",
                "비공개 정렬 장면",
                "공개 입장 재조정 장면",
            ],
            "attention_shift_rules": [
                "직전 intent 변화가 큰 actor는 한 단계 앞으로 당길 수 있다.",
                "최근 focus가 과도했던 actor는 잠시 뒤로 물릴 수 있다.",
            ],
            "budget_guidance": [
                "직접 시뮬레이션 actor 수는 적게 유지하고 핵심 상태 변화만 전면으로 올린다.",
            ],
        },
        "ActionCatalog": {
            "actions": [
                {
                    "action_type": "speech",
                    "label": "직접 발화",
                    "description": "공개 또는 비공개로 직접 말을 건네며 의도를 드러내거나 조정한다.",
                    "role_hints": ["조정자", "대표", "협상 담당"],
                    "group_hints": ["운영팀", "외교팀"],
                    "supported_visibility": ["public", "private", "group"],
                    "requires_target": False,
                    "supports_utterance": True,
                    "examples_or_usage_notes": [
                        "짧은 공개 발언",
                        "비공개 설득",
                    ],
                },
                {
                    "action_type": "reposition",
                    "label": "입장 재정렬",
                    "description": "공식 입장, 배치, 우선순위, 작전 방향을 다시 조정한다.",
                    "role_hints": ["실행 책임자", "작전 담당"],
                    "group_hints": ["작전실", "운영팀"],
                    "supported_visibility": ["public", "private", "group"],
                    "requires_target": False,
                    "supports_utterance": False,
                    "examples_or_usage_notes": [
                        "우선순위 재조정",
                        "작전 배치 변경",
                    ],
                },
            ],
            "selection_guidance": [
                "발화는 여러 액션 중 하나다.",
                "행동은 상황 압박과 visibility 제약에 맞게 고른다.",
            ],
        },
        "CastRosterItem": {
            "cast_id": "cast-operations",
            "display_name": "운영 총괄",
            "role_hint": "실행 일정과 운영 리스크를 조정하는 책임자",
            "group_name": "운영팀",
            "core_tension": "현실적 제약을 말해야 하지만 공개적으로는 안정감을 보여야 한다.",
        },
        "ActorCard": {
            "cast_id": "cast-operations",
            "actor_id": "operations-lead",
            "display_name": "운영 총괄",
            "role": "실행 일정과 운영 리스크를 조정하는 책임자",
            "group_name": "운영팀",
            "public_profile": "공개적으로는 안정적 일정과 책임 있는 실행을 강조한다.",
            "private_goal": "과도한 약속을 막고 팀의 부담을 줄이는 방향으로 상황을 유도한다.",
            "speaking_style": "구체적인 근거를 짧게 제시하고 과장하지 않는다.",
            "avatar_seed": "operations-lead-seed",
            "baseline_attention_tier": "driver",
            "story_function": "실행 제약을 앞세워 흐름을 재조정하는 축이다.",
            "preferred_action_types": ["speech", "reposition"],
            "action_bias_notes": [
                "말보다 일정 재정렬 같은 실행 조정을 선호한다.",
                "직접 발화가 필요하면 짧고 단호하게 말한다.",
            ],
        },
        "StepFocusPlan": {
            "step_index": 2,
            "focus_summary": "이번 단계는 비공개 압박과 공개 입장 정렬이 직접 맞물리는 축을 추적한다.",
            "selection_reason": "직접 target 압력과 직전 intent 변화가 동시에 높아 focus 가치가 가장 크다.",
            "selected_actor_ids": ["operations-lead", "finance-director"],
            "deferred_actor_ids": ["field-lead"],
            "focus_slices": [
                {
                    "slice_id": "step-2-focus-1",
                    "title": "비공개 압박 축",
                    "focus_actor_ids": ["operations-lead", "finance-director"],
                    "visibility": "private",
                    "stakes": "일정 재조정 여부가 다음 단계의 공개 입장을 바꿀 수 있다.",
                    "selection_reason": "직접 target 압력과 action 연쇄가 가장 강하다.",
                }
            ],
        },
        "BackgroundUpdateBatch": {
            "background_updates": [
                {
                    "step_index": 2,
                    "actor_id": "field-lead",
                    "summary": "현장 쪽은 직접 개입하지 않았지만 내부적으로 대응 부담이 커지고 있다.",
                    "pressure_level": "medium",
                    "future_hook": "다음 단계에서 자원 재배치 요구가 전면으로 올라올 수 있다.",
                }
            ]
        },
        "StepAdjudication": {
            "adopted_actor_ids": ["operations-lead"],
            "rejected_action_notes": [
                "finance-director의 제안은 이번 단계 핵심 압력보다 후순위였다."
            ],
            "updated_intent_states": [
                {
                    "actor_id": "operations-lead",
                    "current_intent": "핵심 범위를 다시 정리하도록 방향을 틀게 만든다.",
                    "target_actor_ids": ["finance-director"],
                    "supporting_action_type": "speech",
                    "confidence": 0.82,
                    "changed_from_previous": True,
                }
            ],
            "step_time_advance": {
                "elapsed_unit": "minute",
                "elapsed_amount": 30,
                "selection_reason": "직접 조율과 짧은 반응이 중심이라 긴 시간 점프는 과하다.",
                "signals": ["직접 압박", "짧은 조율"],
            },
            "background_updates": [
                {
                    "step_index": 2,
                    "actor_id": "field-lead",
                    "summary": "현장 쪽은 직접 개입하지 않았지만 대응 부담이 커지고 있다.",
                    "pressure_level": "medium",
                    "future_hook": "다음 단계에서 자원 재배치 요구가 올라올 수 있다.",
                }
            ],
            "event_action": None,
            "world_state_summary_hint": "핵심 압박은 비공개 조율 축에 집중됐고, 배경에서는 대응 부담이 천천히 커지고 있다.",
        },
        "ActorActionProposal": {
            "action_type": "speech",
            "intent": "핵심 범위를 다시 정리하도록 방향을 틀게 만든다.",
            "intent_target_actor_ids": ["finance-director", "field-lead"],
            "action_summary": "운영 총괄이 일정 재조정 방향을 꺼낸다.",
            "action_detail": "현재 인력과 우선순위 기준으로는 기존 일정이 무리라는 점을 분명히 하고, 먼저 핵심 범위를 다시 정리해야 한다는 방향으로 분위기를 민다.",
            "utterance": "지금 기준으로는 기존 일정이 무리입니다. 먼저 핵심 범위를 다시 정리해야 합니다.",
            "visibility": "group",
            "target_actor_ids": ["finance-director", "field-lead"],
            "thread_id": "schedule-alignment",
            "expected_outcome": "일정 재조정 논의가 공식 안건으로 올라간다.",
        },
        "ActorActionProposalPassive": {
            "action_type": "reposition",
            "intent": "현재 우선순위를 조용히 다시 정렬한다.",
            "intent_target_actor_ids": [],
            "action_summary": "운영 총괄이 내부 우선순위를 다시 정리한다.",
            "action_detail": "즉시 공개 발화를 하지는 않고, 다음 단계 판단을 위해 내부 기준과 우선순위를 재정렬한다.",
            "utterance": None,
            "visibility": "public",
            "target_actor_ids": [],
            "thread_id": None,
            "expected_outcome": "다음 단계에서 더 일관된 action 선택이 가능해진다.",
        },
        "ActorIntentStateBatch": {
            "actor_intent_states": [
                {
                    "actor_id": "operations-lead",
                    "current_intent": "핵심 범위를 다시 정리하도록 방향을 틀게 만든다.",
                    "target_actor_ids": ["finance-director", "field-lead"],
                    "supporting_action_type": "speech",
                    "confidence": 0.84,
                    "changed_from_previous": True,
                }
            ],
        },
        "ObserverReport": {
            "step_index": 1,
            "summary": "발화보다 일정 재정렬과 입장 조정 action이 먼저 국면을 움직이기 시작했다.",
            "notable_events": [
                "운영 총괄이 일정 재정렬 방향을 꺼냈다.",
                "핵심 실무자들이 같은 조정 action에 반응하기 시작했다.",
            ],
            "atmosphere": "경계",
            "momentum": "medium",
            "world_state_summary": "발화보다 실제 조정 action이 먼저 누적되면서 선택 방향이 조금씩 갈리고 있다.",
        },
        "ObserverEventProposal": {
            "action_type": "public_event",
            "intent": "기존 action 흐름을 흔들어 선택 재검토를 유도한다.",
            "action_summary": "예정에 없던 공용 일정 변화가 공개된다.",
            "action_detail": "갑작스러운 일정 변경 공지가 나오면서 일부 참가자들이 방금 한 선택과 배치를 다시 계산해야 하는 상황이 된다.",
            "utterance": None,
            "thread_id": "observer-event",
            "expected_outcome": "기존 조정 방향이 다시 열리고 반응 action이 늘어난다.",
        },
    }
    return examples[schema.__name__]
