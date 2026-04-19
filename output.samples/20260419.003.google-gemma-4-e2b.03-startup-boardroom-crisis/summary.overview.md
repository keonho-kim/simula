# 20260419.003.google-gemma-4-e2b.03-startup-boardroom-crisis 분석 요약

## 한눈에 보기
- LLM 호출 121건을 기준으로 분석했습니다.
- 채택된 액션은 24건이며, 실제 연결에 들어온 행위자는 5명이었습니다.
- 분석상 확인된 진행 라운드는 7라운드입니다.

## 무슨 일이 있었나
- 가장 자주 채택된 행동은 내부 리스크 평가 (11건)였습니다.
- 노출 방식 분포는 group 18건, private 5건, public 1건입니다.
- 최근 흐름: 현금 소진율과 기술 부채 해결 비용을 통합적으로 분석하여 구조조정 계획의 현실적인 재무적 타당성을 검토한다.
- 최근 흐름: CTO와 CFO가 현재 현금 런웨이와 기술 부채에 대한 내부 위험을 종합적으로 평가한다.
- 최근 흐름: CTO와 CFO가 현재 현금 런웨이와 기술 부채에 대한 내부 위험을 심층적으로 분석한다.

## 누가 중심에 있었나
- 독립 사외이사(`independent_director`): 4명과 연결됨 (발신 4건, 수신 5건)
  - 발신: 내부 리스크 평가 (2회), 이사회 대결 (2회)
  - 수신: 이사회 대결 (5회)
- CFO(`cfo_financial`): 2명과 연결됨 (발신 5건, 수신 6건)
  - 발신: 내부 리스크 평가 (5회)
  - 수신: 내부 리스크 평가 (6회)
- 공동창업자 CTO(`cto_developer`): 2명과 연결됨 (발신 4건, 수신 7건)
  - 발신: 내부 리스크 평가 (4회)
  - 수신: 내부 리스크 평가 (7회)

## 누가 직접·간접으로 퍼졌나
- 가장 많은 사람과 직접 연결된 사람: 독립 사외이사(`independent_director`), 4명과 직접 연결
- 다른 사람 사이를 가장 많이 이어준 사람: 독립 사외이사(`independent_director`), 중개 중심성 0.0952
- 간접 영향력이 가장 큰 사람: 공동창업자 CTO(`cto_developer`), 간접 영향력 점수 0.3244

## 어떤 action이 준비됐고 무엇이 채택됐나
- 내부 리스크 평가(`internal_risk_assessment`): 채택 11건, 라운드 2-7
- 이사회 대결(`board_confrontation`): 채택 7건, 라운드 1-7
- 브리지 투자 협상(`bridge_investment_negotiation`): 채택 5건, 라운드 2-6
- 유출 대응문 작성(`leak_response_drafting`): 채택 1건, 라운드 1-1
- 핵심 고객사 접촉(`customer_retention_check`): 후보에는 있었지만 채택되지는 않았습니다.

## 연결이 어떻게 늘어났나
- 직접 연결의 중심은 6라운드에 독립 사외이사 쪽으로 바뀌었습니다.
- 중간 다리 역할은 6라운드부터 독립 사외이사가 눈에 띄었습니다.
- 간접 영향력은 7라운드에 공동창업자 CTO 쪽으로 가장 크게 몰렸습니다.
- 최종 라운드에는 참여 행위자 5명, 연결 10개까지 커졌습니다.
- 가장 크게 확장된 시점은 1라운드로, 새 행위자 3명과 새 연결 6개가 더해졌습니다.
- 쏠림이 가장 강했던 시점은 1라운드로, 상위 1명이 전체 연결의 33.3%를 차지했습니다.

## LLM 사용량
- 총 121회 호출에서 전체 442945토큰이 사용됐습니다.
- 대표 응답 속도는 TTFT p95 1.73초, 전체 소요 시간 p95 27.32초입니다.
- task 기준 상위 호출: actor.actor_action_shell 28회, actor.actor_action_narrative 27회, generator.actor_card_generation 8회, coordinator.round_directive_background_updates 7회, coordinator.round_directive_focus_core 7회
- actor (행위자): 55회 호출, 총 195327토큰
- coordinator (조정): 44회 호출, 총 171072토큰
- planner (계획): 8회 호출, 총 28538토큰

## JSON 복구 현황
- JSON 복구 호출은 총 1회, 세션 기준 1건이었습니다.
- 재시도는 총 1회였습니다.
- 알 수 없음: fixer 1회, 재시도 1회

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
