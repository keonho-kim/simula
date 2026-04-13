"""Purpose:
- Verify scenario frontmatter parsing and cleaned-body extraction.
"""

from __future__ import annotations

import pytest

from simula.application.services.scenario_inputs import parse_scenario_document


def test_parse_scenario_document_reads_required_controls() -> None:
    parsed = parse_scenario_document(
        """---
num_cast: 14
allow_additional_cast: false
---

# Scenario

Body
"""
    )

    assert parsed.scenario_controls["num_cast"] == 14
    assert parsed.scenario_controls["allow_additional_cast"] is False
    assert parsed.scenario_text == "# Scenario\n\nBody"


def test_parse_scenario_document_defaults_allow_additional_cast_to_true() -> None:
    parsed = parse_scenario_document(
        """---
num_cast: 8
---

# Scenario

Body
"""
    )

    assert parsed.scenario_controls["num_cast"] == 8
    assert parsed.scenario_controls["allow_additional_cast"] is True
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
allow_additional_cast: maybe
---
body
""",
            "allow_additional_cast는 true 또는 false",
        ),
        (
            """---
num_cast: 0
---
body
""",
            "num_cast는 1 이상의 정수",
        ),
        (
            """---
allow_additional_cast: false
---
body
""",
            "scenario frontmatter에 `num_cast`를 반드시 선언해야 합니다.",
        ),
    ],
)
def test_parse_scenario_document_rejects_invalid_frontmatter(
    text: str,
    expected: str,
) -> None:
    with pytest.raises(ValueError, match=expected):
        parse_scenario_document(text)


def test_parse_scenario_document_requires_frontmatter() -> None:
    with pytest.raises(
        ValueError,
        match="scenario frontmatter에 `num_cast`를 반드시 선언해야 합니다.",
    ):
        parse_scenario_document("# Scenario\n\nBody")
