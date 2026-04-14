"""Purpose:
- Write analyzer artifacts to the `analysis/<run-id>` output tree.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import networkx as nx


@dataclass(slots=True)
class ArtifactWriter:
    """Small helper for deterministic artifact output management."""

    root_dir: Path
    created_files: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def path_for(self, relative_path: str) -> Path:
        path = self.root_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def record_output(self, relative_path: str) -> None:
        normalized = relative_path.replace("\\", "/")
        if normalized not in self.created_files:
            self.created_files.append(normalized)

    def write_json(self, relative_path: str, payload: dict[str, object]) -> Path:
        path = self.path_for(relative_path)
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self.record_output(relative_path)
        return path

    def write_csv(
        self,
        relative_path: str,
        *,
        rows: list[dict[str, object]],
        fieldnames: list[str],
    ) -> Path:
        path = self.path_for(relative_path)
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                writer.writerow(
                    {
                        field_name: _csv_value(row.get(field_name))
                        for field_name in fieldnames
                    }
                )
        self.record_output(relative_path)
        return path

    def write_graphml(self, relative_path: str, graph: nx.DiGraph) -> Path:
        path = self.path_for(relative_path)
        nx.write_graphml(graph, path)
        self.record_output(relative_path)
        return path


def _csv_value(value: Any) -> str | int | float:
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)
