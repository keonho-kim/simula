# 20260419.002.google-gemma-4-e4b.03-startup-boardroom-crisis 분석 요약

## 한눈에 보기
- LLM 호출 137건을 기준으로 분석했습니다.
- 채택된 액션은 29건이며, 실제 연결에 들어온 행위자는 6명이었습니다.
- 분석상 확인된 진행 라운드는 8라운드입니다.

## 무슨 일이 있었나
- 가장 자주 채택된 행동은 투자 조건 협상 (21건)였습니다.
- 노출 방식 분포는 group 1건, private 25건, public 3건입니다.
- 최근 흐름: 재무 모델을 근거로 현금 흐름 안정화에 필요한 최소 투자 규모와 조건을 구체적으로 제시한다.
- 최근 흐름: 잠재적인 대형 투자사와 비공개적으로 자금 조달 조건을 논의한다.
- 최근 흐름: 현재 회사의 재무 및 기술 리스크를 근거로 투자 조건을 강력하게 수정할 것을 제안한다.

## 누가 중심에 있었나
- CFO(`cfo`): 3명과 연결됨 (발신 6건, 수신 9건)
  - 발신: 투자 조건 협상 (6회)
  - 수신: 투자 조건 협상 (8회), 데이터 유출 원인 조사 착수 (1회)
- 창업자 CEO(`founder-ceo`): 3명과 연결됨 (발신 7건, 수신 9건)
  - 발신: 투자 조건 협상 (6회), 언론 대응 및 공식 입장 발표 (1회)
  - 수신: 투자 조건 협상 (8회), 데이터 유출 원인 조사 착수 (1회)
- 리드 투자사 파트너(`lead-investor-partner`): 2명과 연결됨 (발신 6건, 수신 8건)
  - 발신: 투자 조건 협상 (6회)
  - 수신: 투자 조건 협상 (8회)

## 누가 직접·간접으로 퍼졌나
- 가장 많은 사람과 직접 연결된 사람: 창업자 CEO(`founder-ceo`), 3명과 직접 연결
- 다른 사람 사이를 가장 많이 이어준 사람: 창업자 CEO(`founder-ceo`), 중개 중심성 0.0119
- 간접 영향력이 가장 큰 사람: 창업자 CEO(`founder-ceo`), 간접 영향력 점수 0.2061

## 어떤 action이 준비됐고 무엇이 채택됐나
- 투자 조건 협상(`negotiate_funding_terms`): 채택 21건, 라운드 1-8
- 핵심 고객사 비공개 해명 회동(`address_key_customer`): 채택 4건, 라운드 2-4
- 언론 대응 및 공식 입장 발표(`manage_media_response`): 채택 3건, 라운드 2-5
- 데이터 유출 원인 조사 착수(`investigate_security_breach`): 채택 1건, 라운드 7-7
- 핵심 인력 긴급 회의 소집(`call_emergency_staff_meeting`): 후보에는 있었지만 채택되지는 않았습니다.

## 연결이 어떻게 늘어났나
- 직접 연결의 중심은 3라운드에 창업자 CEO 쪽으로 바뀌었습니다.
- 중간 다리 역할은 7라운드부터 창업자 CEO가 눈에 띄었습니다.
- 간접 영향력은 4라운드에 핵심 고객사 CTO 쪽으로 가장 크게 몰렸습니다.
- 최종 라운드에는 참여 행위자 6명, 연결 10개까지 커졌습니다.
- 가장 크게 확장된 시점은 5라운드로, 새 행위자 0명과 새 연결 4개가 더해졌습니다.
- 쏠림이 가장 강했던 시점은 2라운드로, 상위 1명이 전체 연결의 50.0%를 차지했습니다.

## LLM 사용량
- 총 137회 호출에서 전체 481492토큰이 사용됐습니다.
- 대표 응답 속도는 TTFT p95 5.65초, 전체 소요 시간 p95 44.01초입니다.
- task 기준 상위 호출: actor.actor_action_shell 32회, actor.actor_action_narrative 29회, coordinator.round_directive_background_updates 8회, coordinator.round_directive_focus_core 8회, coordinator.round_resolution_core 8회
- actor (행위자): 61회 호출, 총 207790토큰
- coordinator (조정): 55회 호출, 총 199152토큰
- planner (계획): 8회 호출, 총 28502토큰

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
