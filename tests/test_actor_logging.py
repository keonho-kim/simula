"""Purpose:
- Verify actor proposal logs render as detailed multiline feed entries.
"""

from __future__ import annotations

import io
import logging
from types import SimpleNamespace

from simula.application.workflow.graphs.runtime.nodes.actor_turn_prompting import (
    log_actor_proposal_completed,
)
from simula.shared.logging.console import SimulaConsoleFormatter


def test_actor_proposal_log_renders_multiline_card() -> None:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(SimulaConsoleFormatter(use_color=False))
    logger = logging.getLogger("simula.workflow.run.actor-log-test")
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    try:
        log_actor_proposal_completed(
            logger=logger,
            round_index=2,
            actor={"display_name": "창업자 CEO", "cast_id": "ceo-founder"},
            proposal=SimpleNamespace(
                action_type="investor_negotiation",
                visibility="private",
                target_cast_ids=["investor-partner"],
                goal="경영권을 지키며 투자 조건을 유리하게 이끈다.",
                summary="리드 투자사와 비공개 협상을 시도한다.",
                detail="브리지 투자 조건과 경영권 방어선을 함께 제시한다.",
                utterance="우리는 지분만이 아니라 방향성도 지켜야 합니다.",
            ),
            forced_default=False,
            duration_seconds=12.34,
        )
    finally:
        logger.handlers.clear()

    rendered = stream.getvalue()
    assert "[CAST] 창업자 CEO | investor_negotiation | 비공개 | 대상 investor-partner" in rendered
    assert "목표: 경영권을 지키며 투자 조건을 유리하게 이끈다." in rendered
    assert "행동: 리드 투자사와 비공개 협상을 시도한다." in rendered
    assert "세부: 브리지 투자 조건과 경영권 방어선을 함께 제시한다." in rendered
    assert "발언: 우리는 지분만이 아니라 방향성도 지켜야 합니다." in rendered
    assert "소요: 12.34s | round 2" in rendered
