# 20260418.005.google-gemma-4-26b-a4b.03-startup-boardroom-crisis 분석 요약

## 한눈에 보기
- LLM 호출 274건을 기준으로 분석했습니다.
- 채택된 액션은 67건이며, 실제 연결에 들어온 행위자는 8명이었습니다.
- 분석상 확인된 진행 라운드는 17라운드입니다.

## 무슨 일이 있었나
- 가장 자주 채택된 행동은 사실 관계 조사 (24건)였습니다.
- 노출 방식 분포는 group 55건, private 12건입니다.
- 최근 흐름: 기술적 전문성과 경영 리더십의 결합을 통한 안정적인 운영 체제를 제안하며 핵심 이해관계자들의 지지를 확보합니다.
- 최근 흐름: 경영권 이관과 전문 경영인 영입을 골자로 하는 조직 개편안을 제안합니다.
- 최근 흐름: CEO와 CTO를 동시에 대면하여 기술적 신뢰도 위기와 경영권 변동의 상관관계를 질문합니다.

## 누가 중심에 있었나
- Founder CEO(`founder_ceo`): 5명과 연결됨 (발신 16건, 수신 37건)
  - 발신: 이해관계자 포섭 (16회)
  - 수신: 사실 관계 조사 (20회), 조직 개편 제안 (10회), 협상 및 조건 조율 (6회), 외 1종
- Co-founder CTO(`cto_cofounder`): 4명과 연결됨 (발신 11건, 수신 33건)
  - 발신: 사실 관계 조사 (10회), 위기 대응 및 관리 (1회)
  - 수신: 이해관계자 포섭 (16회), 조직 개편 제안 (10회), 사실 관계 조사 (7회)
- Lead Investor Partner(`lead_investor_partner`): 4명과 연결됨 (발신 10건, 수신 15건)
  - 발신: 조직 개편 제안 (10회)
  - 수신: 이해관계자 포섭 (6회), 조직 개편 제안 (4회), 협상 및 조건 조율 (4회), 외 1종

## 누가 직접·간접으로 퍼졌나
- 가장 많은 사람과 직접 연결된 사람: Founder CEO(`founder_ceo`), 5명과 직접 연결
- 다른 사람 사이를 가장 많이 이어준 사람: Founder CEO(`founder_ceo`), 중개 중심성 0.1905
- 간접 영향력이 가장 큰 사람: Co-founder CTO(`cto_cofounder`), 간접 영향력 점수 0.3201

## 어떤 action이 준비됐고 무엇이 채택됐나
- 사실 관계 조사(`investigate_truth`): 채택 24건, 라운드 1-17
- 이해관계자 포섭(`secure_support`): 채택 16건, 라운드 1-17
- 조직 개편 제안(`propose_restructuring`): 채택 14건, 라운드 1-17
- 협상 및 조건 조율(`negotiate_terms`): 채택 12건, 라운드 4-17
- 위기 대응 및 관리(`manage_crisis`): 채택 1건, 라운드 16-16

## 연결이 어떻게 늘어났나
- 직접 연결의 중심은 2라운드에 Co-founder CTO 쪽으로 바뀌었습니다.
- 중간 다리 역할은 2라운드부터 Co-founder CTO가 눈에 띄었습니다.
- 간접 영향력은 1라운드에 Founder CEO 쪽으로 가장 크게 몰렸습니다.
- 최종 라운드에는 참여 행위자 8명, 연결 16개까지 커졌습니다.
- 가장 크게 확장된 시점은 1라운드로, 새 행위자 4명과 새 연결 6개가 더해졌습니다.
- 쏠림이 가장 강했던 시점은 2라운드로, 상위 1명이 전체 연결의 36.4%를 차지했습니다.

## LLM 사용량
- 총 274회 호출에서 전체 1195373토큰이 사용됐습니다.
- 대표 응답 속도는 TTFT p95 9.63초, 전체 소요 시간 p95 71.87초입니다.
- task 기준 상위 호출: actor.actor_action_narrative 68회, actor.actor_action_shell 68회, coordinator.round_resolution_core 18회, coordinator.round_directive_background_updates 17회, coordinator.round_directive_focus_core 17회
- actor (행위자): 136회 호출, 총 559267토큰
- coordinator (조정): 117회 호출, 총 548285토큰
- planner (계획): 8회 호출, 총 35317토큰

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
