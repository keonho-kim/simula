"""Purpose:
- Centralize Korean labels used by analysis outputs.
"""

from __future__ import annotations

METRIC_LABELS = {
    "input_tokens": "입력 토큰",
    "output_tokens": "출력 토큰",
    "ttft_seconds": "TTFT(초)",
    "duration_seconds": "소요 시간(초)",
}

ROLE_LABELS = {
    "planner": "planner (계획)",
    "generator": "generator (생성)",
    "coordinator": "coordinator (조정)",
    "actor": "actor (행위자)",
    "observer": "observer (관찰)",
    "fixer": "fixer (JSON 복구)",
    "overall": "전체",
    "unknown": "알 수 없음",
}

CALL_KIND_LABELS = {
    "structured": "구조화",
    "text": "텍스트",
}

LLM_CALL_COLUMN_LABELS = {
    "run_id": "실행 ID",
    "sequence": "호출 순번",
    "role": "역할",
    "role_label": "역할 표시명",
    "call_kind": "호출 종류",
    "call_kind_label": "호출 종류 표시명",
    "scope": "스코프",
    "phase": "단계",
    "task_key": "태스크 키",
    "task_label": "태스크 표시명",
    "artifact_key": "결과물 키",
    "artifact_label": "결과물 표시명",
    "schema_name": "스키마 이름",
    "section": "섹션",
    "target_role": "대상 역할",
    "target_task_key": "대상 태스크 키",
    "target_artifact_key": "대상 결과물 키",
    "target_schema_name": "대상 스키마 이름",
    "duration_seconds": "소요 시간(초)",
    "ttft_seconds": "첫 토큰 시간(초)",
    "input_tokens": "입력 토큰",
    "output_tokens": "출력 토큰",
    "total_tokens": "총 토큰",
    "log_context": "로그 컨텍스트",
    "prompt": "프롬프트",
    "raw_response": "원본 응답",
}

FIXER_SUMMARY_COLUMN_LABELS = {
    "role": "역할",
    "role_label": "역할 표시명",
    "fixer_call_count": "fixer 호출 수",
    "session_count": "fixer 세션 수",
    "retry_count": "재시도 수",
    "ttft_count": "TTFT 집계 수",
    "ttft_min": "TTFT 최소값",
    "ttft_max": "TTFT 최대값",
    "ttft_mean": "TTFT 평균값",
    "ttft_median": "TTFT 중앙값",
    "ttft_p90": "TTFT p90",
    "ttft_p95": "TTFT p95",
    "ttft_p99": "TTFT p99",
    "duration_count": "소요 시간 집계 수",
    "duration_min": "소요 시간 최소값",
    "duration_max": "소요 시간 최대값",
    "duration_mean": "소요 시간 평균값",
    "duration_median": "소요 시간 중앙값",
    "duration_p90": "소요 시간 p90",
    "duration_p95": "소요 시간 p95",
    "duration_p99": "소요 시간 p99",
}

TOKEN_USAGE_COLUMN_LABELS = {
    "role": "역할",
    "role_label": "역할 표시명",
    "call_count": "호출 수",
    "input_tokens_total": "입력 토큰 누적",
    "output_tokens_total": "출력 토큰 누적",
    "total_tokens_total": "총 토큰 누적",
    "input_tokens_missing_count": "입력 토큰 누락 수",
    "output_tokens_missing_count": "출력 토큰 누락 수",
    "total_tokens_missing_count": "총 토큰 누락 수",
    "input_tokens_count": "입력 토큰 집계 수",
    "input_tokens_min": "입력 토큰 최소값",
    "input_tokens_max": "입력 토큰 최대값",
    "input_tokens_mean": "입력 토큰 평균값",
    "input_tokens_median": "입력 토큰 중앙값",
    "input_tokens_p90": "입력 토큰 p90",
    "input_tokens_p95": "입력 토큰 p95",
    "input_tokens_p99": "입력 토큰 p99",
    "output_tokens_count": "출력 토큰 집계 수",
    "output_tokens_min": "출력 토큰 최소값",
    "output_tokens_max": "출력 토큰 최대값",
    "output_tokens_mean": "출력 토큰 평균값",
    "output_tokens_median": "출력 토큰 중앙값",
    "output_tokens_p90": "출력 토큰 p90",
    "output_tokens_p95": "출력 토큰 p95",
    "output_tokens_p99": "출력 토큰 p99",
    "total_tokens_count": "총 토큰 집계 수",
    "total_tokens_min": "총 토큰 최소값",
    "total_tokens_max": "총 토큰 최대값",
    "total_tokens_mean": "총 토큰 평균값",
    "total_tokens_median": "총 토큰 중앙값",
    "total_tokens_p90": "총 토큰 p90",
    "total_tokens_p95": "총 토큰 p95",
    "total_tokens_p99": "총 토큰 p99",
}

PERFORMANCE_SUMMARY_COLUMN_LABELS = {
    "input_tokens_bin_start": "입력 토큰 bin 시작",
    "input_tokens_bin_end": "입력 토큰 bin 끝",
    "output_tokens_bin_start": "출력 토큰 bin 시작",
    "output_tokens_bin_end": "출력 토큰 bin 끝",
    "call_count": "호출 수",
    "ttft_sample_count": "TTFT 표본 수",
    "duration_sample_count": "소요 시간 표본 수",
    "ttft_p90": "TTFT p90",
    "ttft_p95": "TTFT p95",
    "ttft_p99": "TTFT p99",
    "duration_p90": "소요 시간 p90",
    "duration_p95": "소요 시간 p95",
    "duration_p99": "소요 시간 p99",
}

ACTION_SUMMARY_COLUMN_LABELS = {
    "action_type": "행동 종류 ID",
    "label": "행동 이름",
    "description": "설명",
    "supported_visibility": "지원 노출 방식",
    "adopted_count": "채택 횟수",
    "adopted_round_count": "채택 라운드 수",
    "first_adopted_round": "첫 채택 라운드",
    "last_adopted_round": "마지막 채택 라운드",
    "adopted_share": "채택 비중",
}

INTERACTION_COLUMN_LABELS = {
    "interaction_key": "상호작용 키",
    "grouping_type": "묶음 기준",
    "thread_id": "스레드 ID",
    "participant_cast_ids": "참여자 ID 목록",
    "participant_display_names": "참여자 이름 목록",
    "visibility_modes": "노출 방식 목록",
    "action_types": "행동 종류 목록",
    "round_start": "시작 라운드",
    "round_end": "마지막 라운드",
    "activity_count": "포함 액션 수",
    "representative_interaction": "대표 상호작용",
    "representative_message": "대표 메시지",
    "latest_message": "마지막 메시지",
}

NETWORK_NODE_COLUMN_LABELS = {
    "cast_id": "행위자 ID",
    "display_name": "행위자 이름",
    "initiated_actions": "발신 액션 수",
    "received_actions": "수신 액션 수",
    "sent_relations": "발신 연결 수",
    "received_relations": "수신 연결 수",
    "total_weight": "직접 연결 수",
    "counterpart_count": "상대 수",
    "in_degree_centrality": "내향 중심성",
    "out_degree_centrality": "외향 중심성",
    "betweenness_centrality": "중개 중심성",
    "hub_score": "허브 점수",
    "authority_score": "권위 점수",
    "pagerank": "페이지랭크",
    "core_number": "코어 번호",
    "effective_size": "유효 크기",
}

NETWORK_EDGE_COLUMN_LABELS = {
    "source_cast_id": "출발 행위자 ID",
    "source_display_name": "출발 행위자 이름",
    "target_cast_id": "대상 행위자 ID",
    "target_display_name": "대상 행위자 이름",
    "action_count": "실제 대상 액션 수",
    "intent_only_count": "의도 전용 연결 수",
    "public_count": "공개 연결 수",
    "group_count": "그룹 연결 수",
    "private_count": "비공개 연결 수",
    "thread_event_count": "스레드 연결 수",
    "first_round": "첫 라운드",
    "last_round": "마지막 라운드",
    "total_weight": "누적 연결 횟수",
    "label_preview": "엣지 라벨 요약",
    "label_variant_count": "엣지 라벨 변형 수",
}

NETWORK_GROWTH_COLUMN_LABELS = {
    "round_index": "라운드",
    "cumulative_activity_count": "누적 채택 액션 수",
    "participating_actor_count": "참여 행위자 수",
    "edge_count": "연결 수",
    "largest_component_ratio": "한 그룹으로 이어진 비율",
    "density": "실제 연결 비율",
    "top1_actor_share": "가장 많이 연결된 1명의 비중",
    "top3_actor_share": "상위 3명 점유율",
    "actor_weight_hhi": "행위자 쏠림 HHI",
    "actor_weight_gini": "행위자 쏠림 Gini",
    "top1_edge_share": "상위 1개 연결 점유율",
    "top3_edge_share": "상위 3개 연결 점유율",
    "edge_weight_hhi": "연결 쏠림 HHI",
    "edge_weight_gini": "연결 쏠림 Gini",
    "new_actor_count": "신규 행위자 수",
    "new_edge_count": "신규 연결 수",
    "top_degree_cast_id": "직접 연결 중심 ID",
    "top_degree_display_name": "직접 연결 중심 이름",
    "top_degree_score": "직접 연결 중심 점수",
    "top_broker_cast_id": "중간 연결 중심 ID",
    "top_broker_display_name": "중간 연결 중심 이름",
    "top_broker_score": "중간 연결 중심 점수",
    "top_influence_cast_id": "간접 영향 중심 ID",
    "top_influence_display_name": "간접 영향 중심 이름",
    "top_influence_score": "간접 영향 중심 점수",
}


def metric_label(metric: str) -> str:
    """Return the Korean label for a metric key."""

    return METRIC_LABELS.get(metric, metric)


def role_label(role: str) -> str:
    """Return the Korean label for a role key."""

    return ROLE_LABELS.get(role, role)


def call_kind_label(call_kind: str) -> str:
    """Return the Korean label for one call kind."""

    return CALL_KIND_LABELS.get(call_kind, call_kind)


def overall_distribution_title(*, run_id: str, metric: str) -> str:
    """Build one Korean chart title for overall distributions."""

    return f"{run_id} 전체 {metric_label(metric)} 분포"


def role_distribution_title(*, run_id: str, role: str, metric: str) -> str:
    """Build one Korean chart title for role-level distributions."""

    return f"{run_id} {role_label(role)} {metric_label(metric)} 분포"


def network_title(*, run_id: str) -> str:
    """Build one Korean chart title for the actor graph."""

    return f"{run_id} 행위자 연결도"


def distribution_overview_title(*, run_id: str) -> str:
    """Build one Korean chart title for the combined distribution overview."""

    return f"{run_id} 성능 요약"


def translate_row(
    row: dict[str, object],
    *,
    column_labels: dict[str, str],
) -> dict[str, object]:
    """Translate one row's keys into Korean column labels."""

    return {
        column_labels.get(key, key): value
        for key, value in row.items()
    }
