"""Purpose:
- Summarize planned action options and how often they were adopted.
"""

from __future__ import annotations

from collections import Counter, defaultdict

from simula.application.analysis.models import (
    ActionAdoptionSummaryRecord,
    ActionCatalogReport,
    AdoptedActivityRecord,
    PlannedActionRecord,
)


def build_action_catalog_report(
    *,
    planned_actions: list[PlannedActionRecord],
    adopted_activities: list[AdoptedActivityRecord],
    has_plan_finalized_event: bool,
) -> ActionCatalogReport:
    """Join planned actions with adopted activity counts."""

    if not has_plan_finalized_event:
        return ActionCatalogReport(
            rows=[],
            empty_reason="`plan_finalized` 이벤트가 없어 후보 action catalog를 복원하지 못했습니다.",
        )
    if not planned_actions:
        return ActionCatalogReport(
            rows=[],
            empty_reason="실행 계획에 action catalog가 비어 있습니다.",
        )

    adopted_counts = Counter(
        item.action_type.strip()
        for item in adopted_activities
        if item.action_type.strip()
    )
    adopted_rounds: dict[str, set[int]] = defaultdict(set)
    first_rounds: dict[str, int] = {}
    last_rounds: dict[str, int] = {}

    for activity in adopted_activities:
        action_type = activity.action_type.strip()
        if not action_type:
            continue
        adopted_rounds[action_type].add(activity.round_index)
        first_rounds[action_type] = min(
            first_rounds.get(action_type, activity.round_index),
            activity.round_index,
        )
        last_rounds[action_type] = max(
            last_rounds.get(action_type, activity.round_index),
            activity.round_index,
        )

    total_adopted = sum(adopted_counts.values())
    rows = [
        ActionAdoptionSummaryRecord(
            action_type=item.action_type,
            label=item.label or item.action_type,
            description=item.description,
            supported_visibility=list(item.supported_visibility),
            adopted_count=adopted_counts.get(item.action_type, 0),
            adopted_round_count=len(adopted_rounds.get(item.action_type, set())),
            first_adopted_round=first_rounds.get(item.action_type),
            last_adopted_round=last_rounds.get(item.action_type),
            adopted_share=(
                adopted_counts.get(item.action_type, 0) / total_adopted
                if total_adopted > 0
                else 0.0
            ),
        )
        for item in planned_actions
    ]

    rows.sort(key=lambda item: (-item.adopted_count, item.label, item.action_type))
    return ActionCatalogReport(rows=rows)


__all__ = ["build_action_catalog_report"]
