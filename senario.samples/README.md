# senario.samples

Sample scenario seeds for local runs.

## Files

- `01_consumer_marketing_launch.md`
  - consumer marketing simulation focused on target-segment reaction and conversion
- `02_wargame_iran_us.md`
  - current-affairs war-game focused on the U.S.-Iran standoff
- `03_startup_boardroom_crisis.md`
  - boardroom conflict and survival decisions
- `04_city_hall_disaster_response.md`
  - disaster response and early stabilization
- `05_korean_enterprise_promo_approval_conflict.md`
  - Korean enterprise approval-line conflict over a major promotional decision
- `06_new_technology_internal_conflict.md`
  - new-technology development, internal politics, and organizational adaptation

## Authoring Rules

- Each sample must start with YAML frontmatter.
- `num_cast` is required and sets the requested cast count for the scenario.
- `max_round` is required and sets the default maximum actor activity rounds.
- `allow_additional_cast` is optional and defaults to `true`.
- When `allow_additional_cast: false`, the planner must return exactly `num_cast` cast entries.
- When `allow_additional_cast: true`, the planner must return at least `num_cast` cast entries.
- Samples should be driven by actor disposition and decision pressure, not by long backstory.
- Use one compact `## 주요 등장 인물` section per sample.
- Each cast bullet should merge who the actor is, what they publicly introduce about themselves, and how that affects likely behavior.
- Keep actor blurbs compact and concrete. Prefer low-narrative self-introduction cues over hidden lore.
- For consumer marketing samples, keep awareness, favorability, trial, purchase, and repeat purchase distinct.
- For current-affairs war-game samples, pin the setup to an explicit as-of date and real political constraints.
- For corporate governance or succession samples, keep approval authority, disclosure duty, and stakeholder pressure explicit.
- When useful, add sections such as `행동 현실성 기준`, `즉시 행동 단위`, or other scenario-grounded guardrails.
