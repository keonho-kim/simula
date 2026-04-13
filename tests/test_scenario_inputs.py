"""Purpose:
- Verify scenario frontmatter parsing and cleaned-body extraction.
"""

from __future__ import annotations

import pytest

from simula.application.services.scenario_inputs import parse_scenario_document


def test_parse_scenario_document_reads_frontmatter_bool() -> None:
    parsed = parse_scenario_document(
        """---
create_all_participants: true
---

# Scenario

Body
"""
    )

    assert parsed.scenario_controls["create_all_participants"] is True
    assert parsed.scenario_text == "# Scenario\n\nBody"


def test_parse_scenario_document_uses_false_default_without_frontmatter() -> None:
    parsed = parse_scenario_document("# Scenario\n\nBody")

    assert parsed.scenario_controls["create_all_participants"] is False
    assert parsed.scenario_text == "# Scenario\n\nBody"


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        (
            """---
unknown_key: true
---
body
""",
            "지원하지 않는 scenario frontmatter 키",
        ),
        (
            """---
create_all_participants: maybe
---
body
""",
            "create_all_participants는 true 또는 false",
        ),
    ],
)
def test_parse_scenario_document_rejects_invalid_frontmatter(
    text: str,
    expected: str,
) -> None:
    with pytest.raises(ValueError, match=expected):
        parse_scenario_document(text)
