"""목적:
- 저장소 schema와 checkpoint 테이블을 명시적으로 생성하는 CLI 도구를 제공한다.

설명:
- PostgreSQL provider에서 앱 테이블과 LangGraph checkpoint 테이블을 초기화한다.

사용한 설계 패턴:
- maintenance command 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.loader
- simula.infrastructure.storage.app_store
"""

from __future__ import annotations

import argparse

from simula.infrastructure.config.loader import load_settings
from simula.infrastructure.storage.connection import build_postgresql_conn_string
from simula.infrastructure.storage.factory import create_app_store


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m simula.infrastructure.storage.schema_bootstrap",
        description="simula storage bootstrap",
    )
    parser.add_argument("--env", help="env.toml 경로", required=False)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    settings = load_settings(args.env)

    store = create_app_store(
        settings,
        env_file_hint=args.env,
        bootstrap_schema=True,
    )
    try:
        if (
            settings.storage.provider == "postgresql"
            and settings.runtime.enable_checkpointing
        ):
            from langgraph.checkpoint.postgres import PostgresSaver

            with PostgresSaver.from_conn_string(
                build_postgresql_conn_string(settings.storage.postgresql)
            ) as saver:
                saver.setup()
        print("storage schema bootstrap 완료")
        return 0
    finally:
        store.close()


if __name__ == "__main__":
    raise SystemExit(main())
