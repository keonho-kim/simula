"""Purpose:
- Verify the CLI console formatter keeps logs readable in terminal and plain-text modes.
"""

from __future__ import annotations

import logging

from simula.shared.logging.console import (
    SimulaConsoleFormatter,
    detect_console_color_support,
)


class _FakeStream:
    def __init__(self, *, tty: bool) -> None:
        self._tty = tty

    def isatty(self) -> bool:
        return self._tty


def test_console_formatter_renders_round_badge_with_ansi() -> None:
    formatter = SimulaConsoleFormatter(use_color=True)
    record = logging.LogRecord(
        name="simula.workflow.run.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="ROUND 2 시작\n초점: 긴급 이사회",
        args=(),
        exc_info=None,
    )

    rendered = formatter.format(record)

    assert "\033[" in rendered
    assert "[ROUND]" in rendered
    assert "ROUND 2 시작" in rendered
    assert "초점: 긴급 이사회" in rendered


def test_console_formatter_disables_ansi_in_plain_text_mode() -> None:
    formatter = SimulaConsoleFormatter(use_color=False)
    record = logging.LogRecord(
        name="simula.workflow.run.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="ROUND 1 해소",
        args=(),
        exc_info=None,
    )

    rendered = formatter.format(record)

    assert "\033[" not in rendered
    assert "[ROUND]" in rendered


def test_detect_console_color_support_respects_no_color(monkeypatch) -> None:
    monkeypatch.setenv("NO_COLOR", "1")

    assert detect_console_color_support(_FakeStream(tty=True)) is False


def test_console_formatter_marks_actor_card_as_cast() -> None:
    formatter = SimulaConsoleFormatter(use_color=False)
    record = logging.LogRecord(
        name="simula.workflow.run.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg=(
            "창업자 CEO | investor_negotiation | 비공개 | 대상 investor-partner\n"
            "의도: 경영권 방어\n"
            "행동: 투자 조건 협상\n"
            "발언: 방향성을 지켜야 합니다."
        ),
        args=(),
        exc_info=None,
    )

    rendered = formatter.format(record)

    assert "[CAST]" in rendered
    assert "의도: 경영권 방어" in rendered


def test_console_formatter_marks_graph_node_progress() -> None:
    formatter = SimulaConsoleFormatter(use_color=False)
    record = logging.LogRecord(
        name="simula.workflow.run.test",
        level=logging.DEBUG,
        pathname=__file__,
        lineno=1,
        msg="GRAPH NODE 시작 | graph=planning | node=build_planning_analysis | step=1",
        args=(),
        exc_info=None,
    )

    rendered = formatter.format(record)

    assert "[GRAPH]" in rendered
    assert "node=build_planning_analysis" in rendered
