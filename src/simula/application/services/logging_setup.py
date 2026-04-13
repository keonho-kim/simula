"""목적:
- 애플리케이션 로깅 구성을 담당한다.

설명:
- simula 로거와 외부 라이브러리 로거의 verbosity를 일관되게 설정한다.

사용한 설계 패턴:
- logging setup service 패턴

연관된 다른 모듈/구조:
- simula.entrypoints.bootstrap
"""

from __future__ import annotations

import logging

NOISY_LOGGER_NAMES = (
    "anthropic",
    "google",
    "google_genai",
    "httpcore",
    "httpx",
    "langchain",
    "langchain_core",
    "langsmith",
    "openai",
    "urllib3",
)


def configure_logging(level: str) -> None:
    """애플리케이션 로그는 보이고 외부 라이브러리 로그는 줄인다."""

    numeric_level = getattr(logging, level.upper(), logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    simula_formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(logging.WARNING)

    root_handler = logging.StreamHandler()
    root_handler.setLevel(logging.WARNING)
    root_handler.setFormatter(formatter)
    root_logger.addHandler(root_handler)

    simula_logger = logging.getLogger("simula")
    simula_logger.handlers.clear()
    simula_logger.setLevel(numeric_level)
    simula_logger.propagate = False

    simula_handler = logging.StreamHandler()
    simula_handler.setLevel(numeric_level)
    simula_handler.setFormatter(simula_formatter)
    simula_logger.addHandler(simula_handler)

    for logger_name in NOISY_LOGGER_NAMES:
        external_logger = logging.getLogger(logger_name)
        external_logger.setLevel(logging.WARNING)


def build_run_logger_name(
    *,
    base_name: str,
    run_id: str,
    trial_index: int | None,
    total_trials: int | None,
    parallel: bool,
) -> str:
    """Build a stable per-run logger name for CLI-visible correlation."""

    parts = [base_name]
    if trial_index is not None and total_trials is not None:
        mode = "parallel" if parallel else "serial"
        parts.extend([mode, f"trial-{trial_index}-of-{total_trials}"])
    parts.extend(["run", run_id])
    return ".".join(parts)
