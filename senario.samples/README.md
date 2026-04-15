# senario.samples

Sample scenario seeds for local runs.

## Files

- `01_i-am-solo_31_2026-04-10.md`
  - romance reality-show scenario with a closed cast
- `02_wargame_iran_us.md`
  - current-affairs war-game focused on the U.S.-Iran standoff
- `03_startup_boardroom_crisis.md`
  - boardroom conflict and survival decisions
- `04_city_hall_disaster_response.md`
  - disaster response and early stabilization
- `05_campus_election_scandal.md`
  - election legitimacy and deepfake crisis
- `06_fantasy_court_intrigue.md`
  - succession conflict and front-line control

## Authoring Rules

- Each sample must start with YAML frontmatter.
- `num_cast` is required and sets the requested cast count for the scenario.
- `allow_additional_cast` is optional and defaults to `true`.
- When `allow_additional_cast: false`, the planner must return exactly `num_cast` cast entries.
- When `allow_additional_cast: true`, the planner must return at least `num_cast` cast entries.
- Samples should be driven by actor disposition and decision pressure, not by long backstory.
- Use one compact `## 주요 등장 인물` section per sample.
- Each cast bullet should merge who the actor is, what they publicly introduce about themselves, and how that affects likely behavior.
- Keep actor blurbs compact and concrete. Prefer low-narrative self-introduction cues over hidden lore.
- For romance reality-show samples, prefer verified self-introduction lines or close paraphrases grounded in the self-introduction segment.
- For current-affairs war-game samples, pin the setup to an explicit as-of date and real political constraints.
- When useful, add sections such as `행동 현실성 기준`, `즉시 행동 단위`, or other scenario-grounded guardrails.
