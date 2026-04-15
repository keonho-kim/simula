"""Purpose:
- Verify concentration plot labeling choices for connection-network charts.
"""

from __future__ import annotations

from pathlib import Path

from simula.application.analysis.models import (
    ActorEdgeMetrics,
    ActorNodeMetrics,
    NetworkReport,
    NetworkSummary,
)
from simula.application.analysis.plotting.network_metrics import (
    _CONCENTRATION_ITEM_LIMIT,
    _build_actor_concentration_items,
    _build_edge_concentration_items,
    render_network_concentration_plot,
)


def test_build_actor_concentration_items_uses_display_names() -> None:
    report = _sample_report()

    items = _build_actor_concentration_items(report)

    assert items[0] == ("창업자 CEO", 22.0)
    assert items[1] == ("리드 투자사 파트너", 20.0)


def test_build_edge_concentration_items_uses_connection_labels() -> None:
    report = _sample_report()

    items = _build_edge_concentration_items(report)

    assert items[0][0] == "창업자 CEO -> 리드 투자사 파트너"
    assert items[0][1] == 8.0


def test_render_network_concentration_plot_writes_file(tmp_path: Path) -> None:
    output_path = tmp_path / "concentration.png"

    render_network_concentration_plot(
        run_id="run-1",
        report=_sample_report(),
        output_path=output_path,
    )

    assert output_path.exists()


def test_concentration_items_are_capped_at_twenty() -> None:
    report = NetworkReport(
        nodes=[
            ActorNodeMetrics(
                cast_id=f"actor-{index}",
                display_name=f"행위자 {index}",
                initiated_actions=1,
                received_actions=1,
                sent_relations=25 - index,
                received_relations=0,
                total_weight=25 - index,
                counterpart_count=1,
            )
            for index in range(25)
        ],
        edges=[
            ActorEdgeMetrics(
                source_cast_id=f"source-{index}",
                source_display_name=f"출발 {index}",
                target_cast_id=f"target-{index}",
                target_display_name=f"대상 {index}",
                action_count=1,
                intent_only_count=0,
                public_count=0,
                group_count=0,
                private_count=1,
                thread_event_count=1,
                first_round=1,
                last_round=1,
                total_weight=25 - index,
            )
            for index in range(25)
        ],
        summary=NetworkSummary(
            node_count=25,
            edge_count=25,
            activity_count=25,
            total_actor_count=25,
            participating_actor_count=25,
            participating_actor_ratio=1.0,
            isolated_actor_count=0,
            isolated_actor_ratio=0.0,
            max_edge_weight=25,
            density=0.1,
            weak_component_count=1,
            strong_component_count=1,
            largest_weak_component_size=25,
            largest_weak_component_ratio=1.0,
            largest_strong_component_size=25,
            largest_strong_component_ratio=1.0,
            reciprocity=0.0,
            average_clustering=0.0,
            transitivity=0.0,
            max_core_number=1,
            community_count=1,
        ),
    )

    actor_items = _build_actor_concentration_items(report)
    edge_items = _build_edge_concentration_items(report)

    assert len(actor_items) == _CONCENTRATION_ITEM_LIMIT
    assert len(edge_items) == _CONCENTRATION_ITEM_LIMIT
    assert actor_items[0] == ("행위자 0", 25.0)
    assert edge_items[0][1] == 25.0


def _sample_report() -> NetworkReport:
    return NetworkReport(
        nodes=[
            ActorNodeMetrics(
                cast_id="ceo_founder",
                display_name="창업자 CEO",
                initiated_actions=8,
                received_actions=14,
                sent_relations=8,
                received_relations=14,
                total_weight=22,
                counterpart_count=4,
            ),
            ActorNodeMetrics(
                cast_id="lead_investor_partner",
                display_name="리드 투자사 파트너",
                initiated_actions=6,
                received_actions=14,
                sent_relations=6,
                received_relations=14,
                total_weight=20,
                counterpart_count=4,
            ),
        ],
        edges=[
            ActorEdgeMetrics(
                source_cast_id="ceo_founder",
                source_display_name="창업자 CEO",
                target_cast_id="lead_investor_partner",
                target_display_name="리드 투자사 파트너",
                action_count=8,
                intent_only_count=0,
                public_count=0,
                group_count=0,
                private_count=8,
                thread_event_count=3,
                first_round=1,
                last_round=4,
                total_weight=8,
            ),
            ActorEdgeMetrics(
                source_cast_id="lead_investor_partner",
                source_display_name="리드 투자사 파트너",
                target_cast_id="ceo_founder",
                target_display_name="창업자 CEO",
                action_count=6,
                intent_only_count=0,
                public_count=0,
                group_count=0,
                private_count=6,
                thread_event_count=2,
                first_round=2,
                last_round=4,
                total_weight=6,
            ),
        ],
        summary=NetworkSummary(
            node_count=2,
            edge_count=2,
            activity_count=14,
            total_actor_count=2,
            participating_actor_count=2,
            participating_actor_ratio=1.0,
            isolated_actor_count=0,
            isolated_actor_ratio=0.0,
            max_edge_weight=8,
            density=1.0,
            weak_component_count=1,
            strong_component_count=1,
            largest_weak_component_size=2,
            largest_weak_component_ratio=1.0,
            largest_strong_component_size=2,
            largest_strong_component_ratio=1.0,
            reciprocity=1.0,
            average_clustering=0.0,
            transitivity=0.0,
            max_core_number=1,
            community_count=1,
        ),
    )
