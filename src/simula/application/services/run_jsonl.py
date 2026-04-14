"""Purpose:
- Provide a run-scoped JSONL appender for real-time output updates.
"""

from __future__ import annotations

import json
from pathlib import Path


class RunJsonlAppender:
    """Append stable JSONL events during a run and avoid duplicates."""

    def __init__(self, *, output_dir: str, run_id: str) -> None:
        self.run_dir = Path(output_dir) / run_id
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.run_dir / "simulation.log.jsonl"
        self._seen_event_keys: set[str] = set()
        self._next_index = 1

        self.path.write_text("", encoding="utf-8")

    def append(self, entry: dict[str, object]) -> bool:
        """Append one event if it has not already been written."""

        event_key = str(entry.get("event_key", "")).strip()
        if not event_key:
            raise ValueError("event_key is required for real-time JSONL append.")
        if event_key in self._seen_event_keys:
            return False

        payload = {
            "index": self._next_index,
            **entry,
        }
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
            handle.flush()
        self._seen_event_keys.add(event_key)
        self._next_index += 1
        return True
