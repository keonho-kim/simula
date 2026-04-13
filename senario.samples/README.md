# senario.samples

Sample scenario seeds for local runs.

## Files

- `01_i-am-solo_31_2026-04-10.md`
  - romance reality-show scenario with a closed cast
- `02_wargame_iran_us.md`
  - regional war-game escalation and termination paths
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
- Samples should describe actors, pressures, channels, turning points, and stop conditions without adding viewer-style observation questions.
