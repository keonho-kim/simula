# 20260418.007.google-gemma-4-31b.03-startup-boardroom-crisis 분석 요약

## 한눈에 보기
- LLM 호출 273건을 기준으로 분석했습니다.
- 채택된 액션은 68건이며, 실제 연결에 들어온 행위자는 8명이었습니다.
- 분석상 확인된 진행 라운드는 17라운드입니다.

## 무슨 일이 있었나
- 가장 자주 채택된 행동은 비공개 협상 (29건)였습니다.
- 노출 방식 분포는 group 8건, private 60건입니다.
- 최근 흐름: 리스크 관리 지침 미준수가 공식 기록보다는 실질적인 경영 기조에 따른 합의였음을 주장합니다.
- 최근 흐름: 리드 투자자에게 사퇴 수용 의사를 밝히며, 대외적인 명분과 퇴진 후의 예우를 협상합니다.
- 최근 흐름: CFO가 요구한 단독 재무 승인권을 보장하는 대신, 자금 집행의 무결성과 엄격한 성과 달성을 요구하며 밀실 합의를 진행합니다.

## 누가 중심에 있었나
- 리드 투자사 파트너(`lead_investor`): 2명과 연결됨 (발신 15건, 수신 21건)
  - 발신: 압박 및 요구 (13회), 비공개 협상 (2회)
  - 수신: 비공개 협상 (21회)
- 창업자 CEO(`founder_ceo`): 5명과 연결됨 (발신 17건, 수신 24건)
  - 발신: 비공개 협상 (17회)
  - 수신: 압박 및 요구 (19회), 사실 관계 확인 (4회), 비공개 협상 (1회)
- CFO(`cfo`): 1명과 연결됨 (발신 10건, 수신 9건)
  - 발신: 비공개 협상 (10회)
  - 수신: 압박 및 요구 (8회), 비공개 협상 (1회)

## 누가 직접·간접으로 퍼졌나
- 가장 많은 사람과 직접 연결된 사람: 창업자 CEO(`founder_ceo`), 5명과 직접 연결
- 다른 사람 사이를 가장 많이 이어준 사람: 창업자 CEO(`founder_ceo`), 중개 중심성 0.4762
- 간접 영향력이 가장 큰 사람: 창업자 CEO(`founder_ceo`), 간접 영향력 점수 0.2607

## 어떤 action이 준비됐고 무엇이 채택됐나
- 비공개 협상(`negotiate_deal`): 채택 29건, 라운드 1-17
- 사실 관계 확인(`verify_fact`): 채택 20건, 라운드 1-17
- 압박 및 요구(`exert_pressure`): 채택 19건, 라운드 1-16
- 공식 입장 발표(`issue_statement`): 후보에는 있었지만 채택되지는 않았습니다.
- 이사회 의결(`board_vote`): 후보에는 있었지만 채택되지는 않았습니다.

## 연결이 어떻게 늘어났나
- 직접 연결의 중심은 2라운드에 창업자 CEO 쪽으로 바뀌었습니다.
- 중간 다리 역할은 2라운드부터 창업자 CEO가 눈에 띄었습니다.
- 간접 영향력은 6라운드에 테크 전문 기자 쪽으로 가장 크게 몰렸습니다.
- 최종 라운드에는 참여 행위자 8명, 연결 14개까지 커졌습니다.
- 가장 크게 확장된 시점은 1라운드로, 새 행위자 4명과 새 연결 4개가 더해졌습니다.
- 쏠림이 가장 강했던 시점은 5라운드로, 상위 1명이 전체 연결의 35.0%를 차지했습니다.

## LLM 사용량
- 총 273회 호출에서 전체 1082595토큰이 사용됐습니다.
- 대표 응답 속도는 TTFT p95 71.14초, 전체 소요 시간 p95 319.13초입니다.
- task 기준 상위 호출: actor.actor_action_narrative 68회, actor.actor_action_shell 68회, coordinator.round_directive_background_updates 17회, coordinator.round_directive_focus_core 17회, coordinator.round_resolution_core 17회
- actor (행위자): 136회 호출, 총 507790토큰
- coordinator (조정): 116회 호출, 총 498205토큰
- planner (계획): 8회 호출, 총 29841토큰

## JSON 복구 현황
- JSON 복구 호출은 없었습니다.

## 어디를 더 보면 되는가
- `data/actions.summary.csv`: 후보 action과 실제 채택 횟수를 비교할 때
- `assets/performance.summary.png`: 전체 호출 성능 분포를 한눈에 볼 때
- `data/performance.summary.csv`: input/output 토큰 크기 조합별 TTFT·소요 시간 p90/p95/p99를 볼 때
- `data/network.growth.csv`: 라운드별 연결 변화 수치를 직접 확인할 때
- `assets/network.growth_metrics.png`: 연결이 늘어나는 흐름을 빠르게 볼 때
- `assets/network.concentration.png`: 연결이 어느 쪽에 몰렸는지 볼 때
- `assets/network.growth.mp4`: 연결이 늘어나는 순서를 정지 가능한 영상으로 볼 때
- `summaries/token_usage.summary.md`: 역할별 토큰 사용량을 확인할 때
- `data/llm_calls.csv`: 개별 호출과 원문 응답을 직접 추적할 때
