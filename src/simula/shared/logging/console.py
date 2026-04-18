"""Purpose:
- Provide a TTY-aware console formatter for the interactive CLI feed.
"""

from __future__ import annotations

import logging
import os
from typing import TextIO

_RESET = "\033[0m"
_DIM = "\033[2m"
_BOLD = "\033[1m"

_STAGE_COLORS = {
    "RUN": "\033[38;5;81m",
    "SIM": "\033[38;5;117m",
    "ROUND": "\033[38;5;45m",
    "CAST": "\033[38;5;151m",
    "LLM": "\033[38;5;214m",
    "WARN": "\033[38;5;221m",
    "ERROR": "\033[38;5;203m",
}


class SimulaConsoleFormatter(logging.Formatter):
    """Render simula logs as a compact terminal feed."""

    default_time_format = "%H:%M:%S"

    def __init__(self, *, use_color: bool) -> None:
        super().__init__(datefmt=self.default_time_format)
        self.use_color = use_color

    def format(self, record: logging.LogRecord) -> str:
        timestamp = self.formatTime(record, self.datefmt)
        message = record.getMessage().rstrip()
        if record.exc_info:
            exception_text = self.formatException(record.exc_info)
            if message:
                message = f"{message}\n{exception_text}"
            else:
                message = exception_text

        stage = _stage_label(record.name, message)
        badge = self._badge(stage)
        prefix = f"{self._timestamp(timestamp)} {badge}"
        if record.levelno >= logging.ERROR:
            prefix = f"{prefix} {self._level('ERROR')}"
        elif record.levelno >= logging.WARNING:
            prefix = f"{prefix} {self._level('WARN')}"
        return _prefix_multiline(prefix, message or "(empty)")

    def _timestamp(self, value: str) -> str:
        if not self.use_color:
            return value
        return f"{_DIM}{value}{_RESET}"

    def _badge(self, label: str) -> str:
        plain = f"[{label}]"
        if not self.use_color:
            return plain
        color = _STAGE_COLORS.get(label, "")
        return f"{_BOLD}{color}{plain}{_RESET}"

    def _level(self, label: str) -> str:
        plain = f"[{label}]"
        if not self.use_color:
            return plain
        color = _STAGE_COLORS.get(label, "")
        return f"{_BOLD}{color}{plain}{_RESET}"


def detect_console_color_support(stream: TextIO) -> bool:
    """Return whether the console formatter should emit ANSI codes."""

    if os.environ.get("NO_COLOR") is not None:
        return False
    isatty = getattr(stream, "isatty", None)
    if callable(isatty):
        try:
            return bool(isatty())
        except OSError:
            return False
    return False


def _stage_label(logger_name: str, message: str) -> str:
    stripped = message.lstrip()
    if logger_name.startswith("simula.llm"):
        return "LLM"
    if stripped.startswith("ROUND "):
        return "ROUND"
    if (
        "등장 인물" in stripped
        or "행동 제안" in stripped
        or "\n의도:" in stripped
        or "\n행동:" in stripped
        or "\n발언:" in stripped
    ):
        return "CAST"
    if logger_name.startswith("simula.bootstrap") or logger_name.startswith(
        "simula.application.executor"
    ):
        return "RUN"
    return "SIM"


def _prefix_multiline(prefix: str, message: str) -> str:
    lines = message.splitlines() or [message]
    if len(lines) == 1:
        return f"{prefix} {lines[0]}"
    indent = " " * (_visible_width(prefix) + 1)
    tail = "\n".join(f"{indent}{line}" for line in lines[1:])
    return f"{prefix} {lines[0]}\n{tail}"


def _visible_width(text: str) -> int:
    width = 0
    in_escape = False
    for char in text:
        if in_escape:
            if char == "m":
                in_escape = False
            continue
        if char == "\033":
            in_escape = True
            continue
        width += 1
    return width
