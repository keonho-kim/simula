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

- Each sample may start with YAML frontmatter.
- `create_all_participants: true` means the planner must include the full closed cast in `cast_roster`.
- `create_all_participants: false` means the planner should generate a large-enough cast for autonomous simulation while preserving core scenario actors.
- Samples should describe actors, pressures, channels, turning points, and stop conditions without adding viewer-style observation questions.
