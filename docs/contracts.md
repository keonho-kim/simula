# 계약

## 설정 계약

### 우선순위

- CLI
- 환경 변수
- `env.toml`
- 기본값

### 핵심 runtime 필드

| 필드 | 의미 |
| --- | --- |
| `max_steps` | 최대 step 수 |
| `max_recipients_per_message` | actor proposal 수신자 상한 |
| `enable_checkpointing` | checkpoint 사용 여부 |
| `rng_seed` | 재현 가능한 runtime 분기용 선택 seed |

## 상태 계약

### 핵심 채널

| 채널 | 역할 |
| --- | --- |
| `scenario` | 원본 시나리오 |
| `plan` | planning 결과 |
| `action_catalog` | planner가 도출한 scenario 전역 action catalog |
| `actors` | actor registry |
| `activities` | 전체 canonical action JSON |
| `latest_step_activities` | 현재 step action |
| `focus_candidates` | coordinator 후보 actor pool |
| `step_focus_plan` | 이번 step focus 선택 결과 |
| `step_focus_history` | step별 focus 기록 |
| `selected_actor_ids` | 직접 호출된 actor 목록 |
| `deferred_actor_ids` | background digest로만 반영된 actor 목록 |
| `background_updates` | off-screen actor 배경 변화 digest |
| `observer_reports` | step별 observer 요약 |
| `actor_intent_states` | actor별 현재 intent snapshot |
| `intent_history` | step별 intent 변화 이력 |
| `progression_plan` | planner가 정한 동적 시간 진행 계획 |
| `simulation_clock` | 현재 누적 경과 시간 snapshot |
| `step_time_history` | step별 실제 경과 시간 기록 |
| `world_state_summary` | 누적 세계 상태 |
| `step_index` | 현재 step |
| `stagnation_steps` | 저활동/저속 단계 누적 수 |
| `rng_seed` | run별 deterministic seed |
| `stop_requested` | 종료 플래그 |
| `final_report` | 최종 요약 JSON |
| `report_timeline_anchor_json` | 보고서용 절대시각 anchor |
| `report_projection_json` | 보고서용 projection |

### 상태 원칙

- raw action과 observer 해석을 분리한다.
- finalization은 추가 projection을 만들어 보고서 입력을 정제한다.
- report projection은 `timeline_packets`, `endgame_packets`, `actor_digests`, `final_actor_snapshots`, `final_outcome_clues`를 포함할 수 있다.
- 현재 runtime은 `world_state_summary`, 직전 `momentum`, 직전 `atmosphere`, `channel_guidance`, `current_constraints`, filtered action options, 현재 intent snapshot, 현재 `simulation_clock`, 자기 focus slice를 actor prompt에 다시 공급한다.

### Observer 신호 의미

- `atmosphere`
  - 현재 step의 정서적/사회적 분위기 라벨
  - 현재 구현에서는 보고와 prompt tone 입력에 사용한다
- `momentum`
  - 현재 phase의 거친 진행 속도 신호
  - 현재 구현에서는 활성 actor 선택, 사건 확률, 조기 종료 판단에 사용한다

## 구조화 출력 계약

### planning

- `ScenarioInterpretation`
- `RuntimeProgressionPlan`
- `SituationBundle`
- `ActionCatalog`
- `CastRosterItem`

### generation / runtime

- `ActorCard`
- `ActorActionProposal`
- `CanonicalAction`
- `CoordinationFrame`
- `StepFocusPlan`
- `BackgroundUpdateBatch`
- `StepAdjudication`
- `StepTimeAdvanceProposal`
- `StepTimeAdvanceRecord`
- `SimulationClockSnapshot`
- `ObserverReport`

### finalization

- `FinalReport`
- `TimelineAnchorDecision`

### 규칙

- planner roster만 NDJSON
- 나머지는 JSON 단일 객체
- `RuntimeProgressionPlan`은 허용 시간 단위와 기본 pacing 단위를 담는다
- visibility는 `public`, `private`, `group`만 허용한다
- 현재 `ActorCard`는 `baseline_attention_tier`, `story_function`, `preferred_action_types`, `action_bias_notes`를 포함한다

### 강화 후보 타입

- runtime state 후보
  - `relationship_edges`
  - `open_threads`
  - `incident_state`
- actor card 후보
  - `risk_tolerance`
  - `initiative_bias`
  - `disclosure_bias`
  - `loyalty_bias`

## 저장 계약

| 저장 대상 | 의미 |
| --- | --- |
| `runs` | 실행 메타 정보 |
| `actors` | actor registry |
| `activities` | canonical activity |
| `observer_reports` | step별 observer report |
| `final_reports` | 최종 요약 JSON |

## 실패 처리 계약

- 설정 검증 실패는 즉시 예외 처리
- 구조화 파싱 실패는 명시적 실패
- 저장 스키마 불일치는 즉시 실패
- 실행 실패 시 run 상태에 실패 이유 기록
- checkpoint는 명시적으로 켤 때만 요구

### 현재 구현 메모

- actor proposal parsing 실패는 기본 대기 행동으로 대체될 수 있다
- observer summary 자체는 기본 요약으로 대체하지 않고 그대로 실패한다
