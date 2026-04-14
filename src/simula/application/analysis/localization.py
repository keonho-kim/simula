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
    "ttft_p95": "TTFT p95",
    "ttft_p99": "TTFT p99",
    "duration_count": "소요 시간 집계 수",
    "duration_min": "소요 시간 최소값",
    "duration_max": "소요 시간 최대값",
    "duration_mean": "소요 시간 평균값",
    "duration_median": "소요 시간 중앙값",
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
}

NETWORK_NODE_COLUMN_LABELS = {
    "cast_id": "행위자 ID",
    "display_name": "행위자 이름",
    "initiated_actions": "발신 액션 수",
    "received_actions": "수신 액션 수",
    "sent_relations": "발신 관계 수",
    "received_relations": "수신 관계 수",
    "total_weight": "총 관계 가중치",
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
    "total_weight": "총 연결 가중치",
    "label_preview": "엣지 라벨 요약",
    "label_variant_count": "엣지 라벨 변형 수",
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

    return f"{run_id} 행위자 관계도"


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
