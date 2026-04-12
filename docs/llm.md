# LLM 설계

## 역할 모델

| 역할 | 책임 | 대표 출력 |
| --- | --- | --- |
| Planner | 시나리오 해석, progression plan, 상황 번들, action catalog, cast roster | planning 구조화 결과 |
| Generator | cast를 actor 카드로 변환 | actor registry |
| Actor | step별 action 제안 | actor action proposal |
| Observer | intent 추적, 국면 요약, 세계 상태 압축, 이벤트 제안 | observer report |

## 현재 구현

- Generator는 cast item뿐 아니라 interpretation, situation, action catalog를 함께 읽는다.
- Actor는 최근 visible action 외에도 `simulation_objective`, `channel_guidance`, `current_constraints`, filtered action options, 현재 intent snapshot, 현재 `simulation_clock`, 직전 observer 요약/속도/분위기를 읽는다.
- Actor는 자유 발화가 아니라 planner가 만든 action catalog 안에서 action을 고른다.
- `발화`는 action의 한 종류이거나 optional 결과로만 취급한다.
- Observer는 별도 node에서 이번 step의 시간 경과도 추론한다.
- Observer는 `summary`, `notable_events`, `atmosphere`, `momentum`, `world_state_summary`를 만든다.
- Observer는 별도 node에서 actor intent snapshot도 갱신한다.
- `momentum`은 현재 phase의 속도 신호이고, `atmosphere`는 현재 phase의 톤 신호다.

## 프롬프트 철학

- 프롬프트 자산은 Python singleton으로 관리한다.
- 구조화 출력 계약을 먼저 고정한다.
- 자유 서술보다 상태 해석과 보고서 조립에 초점을 둔다.

## 구조화 출력 정책

- planner roster는 NDJSON
- 그 외는 JSON 단일 객체
- pydantic validation 실패는 즉시 오류

## 현재 실패 처리 메모

- planner와 generation의 구조화 파싱 실패는 즉시 실패 경로로 본다.
- actor proposal은 현재 기본 대기 행동으로 대체될 수 있다.
- observer event proposal은 현재 기본 사건으로 대체될 수 있다.
- 따라서 "모든 파싱 실패가 즉시 실패"는 아직 현재 코드의 truth가 아니다.

## 시간 진행 원칙

- planner는 고정 step 간격이 아니라 `RuntimeProgressionPlan`을 만든다.
- progression plan은 허용 단위(`minute/hour/day/week`)와 기본 pacing 단위를 담는다.
- observer는 최신 action과 intent 상태를 읽고 step별 실제 경과 시간을 추론한다.
- 한 step은 최소 `30분` 이상 진행된다.
- 최종 타임라인은 누적 `step_time_history.total_elapsed_minutes`를 절대시각 anchor에 더해 복원한다.

## observer 규칙

- observer summary는 activity를 직접 생성하지 않는다.
- `momentum`
  - `low`: 정체나 느린 전개 신호
  - `medium`: 현재 기본 진행 속도
  - `high`: 빠른 전환 신호
- `atmosphere`
  - 한국어 짧은 톤 라벨
  - actor prompt의 행동 강도와 말투 편향에 참고된다.
- public event는 별도 확률 분기에서만 생성된다.

## finalization 규칙

- `시뮬레이션 결론`은 `### 최종 상태`, `### 핵심 이유` 아래 bullet만 허용
- `행위자 별 최종 결과`는 표 본문 행만 생성하고 `### 최종 결과 표`는 코드에서 고정
- `시뮬레이션 타임라인`은 절대시각 bullet을 생성하고 `### 전체 흐름`은 코드에서 고정
- `행위자 역학 관계`는 `### 현재 구도`, `### 관계 변화` 두 소제목을 사용한다
- `주요 사건과 결과`는 bullet을 생성하고 `### 분기점 사건`은 코드에서 고정
- 형식 검증 실패 시 1회 재생성 후 실패 처리

## 강화 후보

- actor latent trait가 prompt 입력에 직접 들어가도록 확장
- incident family와 pressure point를 직접 연결하는 observer event prompt
- 관계 그래프 상태를 finalization prompt 입력으로 추가
