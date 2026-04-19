# 20260418.004.qwen3-6-35b-a3b-nvfp4.03-startup-boardroom-crisis 분석 요약

## 한눈에 보기
- LLM 호출 94건을 기준으로 분석했습니다.
- 채택된 액션은 14건이며, 실제 연결에 들어온 행위자는 5명이었습니다.
- 분석상 확인된 진행 라운드는 5라운드입니다.

## 무슨 일이 있었나
- 가장 자주 채택된 행동은 브리지 투자 조건 협상 (9건)였습니다.
- 노출 방식 분포는 group 5건, private 9건입니다.
- 최근 흐름: CTO는 내부고발 채널을 통해 확인된 기술 부채 및 보안 취약점 데이터를 독립 사외이사와 CFO에게 전달하며 법적·재무적 대응 기반을 마련한다.
- 최근 흐름: 창업자 CEO는 리드 투자사 파트너와 독립 사외이사를 대상으로 긴급 이사회 표결을 진행하여 경영권 유지와 구조조정안 수용 여부를 최종 결정한다.
- 최근 흐름: 리드 투자사 파트너는 이사회에서 구조조정안 수용과 경영권 이전 조건을 명시하는 긴급 표결을 진행하여 회사의 생존 경로를 최종 확정한다.

## 누가 중심에 있었나
- 리드 투자사 파트너(`lead_investor_partner`): 2명과 연결됨 (발신 5건, 수신 5건)
  - 발신: 브리지 투자 조건 협상 (4회), 긴급 이사회 표결 대결 (1회)
  - 수신: 브리지 투자 조건 협상 (4회), 긴급 이사회 표결 대결 (1회)
- 창업자 CEO(`founder_ceo`): 2명과 연결됨 (발신 5건, 수신 3건)
  - 발신: 브리지 투자 조건 협상 (4회), 긴급 이사회 표결 대결 (1회)
  - 수신: 브리지 투자 조건 협상 (2회), 긴급 이사회 표결 대결 (1회)
- 독립 사외이사(`independent_director`): 3명과 연결됨 (발신 0건, 수신 5건)
  - 발신: 없음
  - 수신: 내부고발자 사실 확인 채널 운영 (3회), 긴급 이사회 표결 대결 (2회)

## 누가 직접·간접으로 퍼졌나
- 가장 많은 사람과 직접 연결된 사람: 독립 사외이사(`independent_director`), 3명과 직접 연결
- 다른 사람 사이를 가장 많이 이어준 사람: 뚜렷한 후보를 계산하지 못했습니다.
- 간접 영향력이 가장 큰 사람: 리드 투자사 파트너(`lead_investor_partner`), 간접 영향력 점수 0.2219

## 어떤 action이 준비됐고 무엇이 채택됐나
- 브리지 투자 조건 협상(`bridge_fund_negotiation`): 채택 9건, 라운드 1-4
- 내부고발자 사실 확인 채널 운영(`internal_whistleblower_verification`): 채택 3건, 라운드 2-5
- 긴급 이사회 표결 대결(`emergency_board_vote`): 채택 2건, 라운드 5-5
- 유출 슬랙 캡처 기사 대응(`leak_response_control`): 후보에는 있었지만 채택되지는 않았습니다.
- 핵심 고객사 비공개 해명(`client_retention_negotiation`): 후보에는 있었지만 채택되지는 않았습니다.

## 연결이 어떻게 늘어났나
- 직접 연결의 중심은 5라운드에 독립 사외이사 쪽으로 바뀌었습니다.
- 중간 다리 역할이 두드러질 만큼 복잡한 연결 구조는 나타나지 않았습니다.
- 간접 영향력은 3라운드에 창업자 CEO 쪽으로 가장 크게 몰렸습니다.
- 최종 라운드에는 참여 행위자 5명, 연결 6개까지 커졌습니다.
- 가장 크게 확장된 시점은 5라운드로, 새 행위자 1명과 새 연결 3개가 더해졌습니다.
- 쏠림이 가장 강했던 시점은 1라운드로, 상위 1명이 전체 연결의 50.0%를 차지했습니다.

## LLM 사용량
- 총 94회 호출에서 전체 482395토큰이 사용됐습니다.
- 대표 응답 속도는 TTFT p95 8.14초, 전체 소요 시간 p95 87.28초입니다.
- task 기준 상위 호출: actor.actor_action_shell 20회, actor.actor_action_narrative 18회, generator.actor_card_generation 8회, coordinator.round_continuation 5회, coordinator.round_directive_background_updates 5회
- actor (행위자): 38회 호출, 총 185082토큰
- coordinator (조정): 35회 호출, 총 183356토큰
- planner (계획): 8회 호출, 총 42003토큰

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
