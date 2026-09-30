# Bundled simulation examples

These twelve Korean examples demonstrate Simula's purpose: read supplied material, frame a
bounded decision, let actors with different responsibilities interact, and explain the observed
development and remaining uncertainty. They are functional PoC examples, not load benchmarks.
All organizations, people, figures, and operational rules in the current collection are fictional.

The directory name `senario.samples` and the twelve filenames are retained because configuration,
sample URLs, and saved references use them. In particular, `02_wargame_iran_us.md` now contains a
fictional maritime negotiation, not a current-affairs account of the United States or Iran.

## Choosing an example

| File | Decision to explore | Cast | Load | Useful report questions |
| --- | --- | ---: | --- | --- |
| [01_consumer_marketing_launch.md](./01_consumer_marketing_launch.md) | Allocate a small launch-test budget | 4 | middle | Did attention, trial, purchase, and repeat purchase stay distinct? What evidence changed the experiment? |
| [02_wargame_iran_us.md](./02_wargame_iran_us.md) | Agree on a temporary civilian transit process and joint notice | 6 | high | Did the parties separate verification, responsibility, and authority? Where did agreement stop? |
| [03_startup_boardroom_crisis.md](./03_startup_boardroom_crisis.md) | Coordinate bridge-funding review, release scope, and customer response | 5 | middle | Was a funding proposal confused with cash received? Which customer concern changed the operating plan? |
| [04_city_hall_disaster_response.md](./04_city_hall_disaster_response.md) | Allocate limited transport and verify reception capacity | 6 | high | Were seats, accessibility, and confirmed support treated as different constraints? |
| [05_korean_enterprise_promo_approval_conflict.md](./05_korean_enterprise_promo_approval_conflict.md) | Revise a promotion's price, quantity, budget, and claims | 5 | middle | Which constraints changed the submitted terms? Who actually approved them? |
| [06_new_technology_internal_conflict.md](./06_new_technology_internal_conflict.md) | Define a bounded internal AI pilot | 5 | middle | Were demo results distinguished from workflow performance? Who owns review and stop conditions? |
| [07_relationship_triangle_conflict.md](./07_relationship_triangle_conflict.md) | Agree on today's plans without forcing an emotional answer | 3 | low | Did participants distinguish consent, interpretation, and practical scheduling? |
| [08_family_clinic_care_decision.md](./08_family_clinic_care_decision.md) | Coordinate a family's available support and follow-up questions | 4 | low | Did concern become an explicit commitment? Which time slots and bookings remain unconfirmed? |
| [09_apartment_redevelopment_committee.md](./09_apartment_redevelopment_committee.md) | Decide what information a resident briefing still needs | 5 | middle | Was a recommendation mistaken for approval? Whose concerns changed the disclosure plan? |
| [10_regional_bank_social_media_run.md](./10_regional_bank_social_media_run.md) | Respond to service delays and an unverified rumor | 6 | high | Were partial operational figures confused with institutional guarantees? Did answers address the actual questions? |
| [11_airport_weather_disruption_command.md](./11_airport_weather_disruption_command.md) | Coordinate passenger support and consistent delay notices | 6 | high | Did the plan expose unmet capacity and accessibility needs instead of assuming them away? |
| [12_hospital_network_ransomware_coordination.md](./12_hospital_network_ransomware_coordination.md) | Coordinate outage verification, operational impact, and patient notices | 6 | high | Did technical uncertainty remain separate from operational decisions and completed recovery? |

Start with 07 or 08 for a small dialogue, 01 or 05 for a material-grounded business decision,
and the high-load group for more interacting constraints. Load labels describe relative scope;
they are not measured execution times. The previous 20–100-actor seeds have been replaced by
3–6 named decision participants. Institutions and affected groups do not each become extra actors.

## Structure and interpretation

Every example is self-contained and contains:

1. A concrete decision, setting, and time boundary.
2. Three short source excerpts with units, dates or relative times, and stated limitations.
3. A distinction between supplied observations, scenario assumptions, and unknowns.
4. A roster matching `num_cast`, with each actor's authority, incentives, constraints, and room to change position.
5. Possible actions and the limits of each participant's authority.
6. Conditional developments rather than mandatory incidents or a prescribed ending.
7. Completion and unresolved-state criteria within a small round budget.
8. Questions for the outcome-focused report and for comparing worlds.

The `자료 1`–`자료 3` labels are human-readable positions inside each Markdown document.
They are not backend evidence identifiers, external citations, or independently verified facts.
The generation pipeline still owns actual source references and accepted output structure.

Initial excerpts are shared with all listed participants. Do not label a fact as a secret and
assume prose alone enforces access control. Later private interactions retain the application's
normal visibility rules. Source permissions for newly uploaded material remain the responsibility
of the existing ScenarioBuilder workflow.

A request is not approval; approval is not execution; and a plan is not an observed result.
A solitary action is not speech to another actor. Actors may change their position after a
concrete clarification or modified offer, but need not converge on agreement. Medical, financial,
legal, and safety-related examples explore communication and coordination within fictional
conditions, not authoritative real-world advice or operating procedures.

## Defaults and execution

All bundled examples now use:

```text
---
num_cast: 4
allow_additional_cast: false
actions_per_type: 2
max_round: 4
fast_mode: false
autonomous_progress: false
output_length: short
load_level: middle
---
```

Only cast size and relative load vary by example. The fixed roster, compact responses, and
sequential default keep the starting workload bounded for local small models. These are example
defaults, not new application limits or a claim of model-quality or speed certification.

- `num_cast` is a positive integer and matches the explicit roster.
- `allow_additional_cast` is false so the example does not expand its cast on its own.
- `actions_per_type` controls action-catalog size; it is not a count of events that must happen.
- `max_round` is a simulation-round limit, not a schedule for predetermined story beats.
- `autonomous_progress` is false. A user can enable the existing autonomy option in setup.
- `fast_mode` is false. Fast Mode may parallelize independent work when the user enables it;
  provider concurrency still follows settings.
- `output_length` is short and also informs actor-memory compression length.
- `load_level` is `low`, `middle`, or `high` and controls the sample picker's grouping.

The reader may select Multiverse and a world count in the preview. World count is separate from
cast size and provider-call concurrency. In the current flow, a single sample uses direct launch;
a multiverse sample enters shared scenario preparation once, then independent world preparation.
Review the generated shared scenario before confirmation. Markdown authoring guidance is model
context, not an additional executable rule engine.

For a controlled comparison, keep source figures, initial observations, and authority boundaries
fixed. Compare the actual differences in proposals, reactions, commitments, and unresolved issues.
Do not invent a favorable event in one world solely to make its ending different. Observed world
frequencies are not probabilities of real-world outcomes. The report should explain turning points
and material gaps rather than manufacture SWOT scores or a guaranteed forecast.

The files can also be uploaded as Markdown through New Scenario to exercise the document path.
Their embedded records are text examples, not a test of PDF images, spreadsheet parsing, or VLM
quality. Small format fixtures remain separately owned by `sample-input-items/`.

## Storage and updates

This collection is browser sample seed version `2`. Updating the seed version makes the sample
picker fetch and persist the new collection into its versioned SQLite sample namespace. Existing
user scenarios, drafts, run history, and older stored sample rows are not overwritten. The picker
lists only the current sample version. A network connection to the application server is needed
the first time that version is loaded.

When changing bundled example content or controls, update
`src/ui/browser-storage/database/samples/seed-version.ts`; otherwise browsers whose seed marker
is already current can continue to show the old content. Do not change filenames just to refresh
content. Each file uses one top-level heading so the server and browser derive the same title.

## Verification

Run `bun test packages/core/tests/scenario-parsing.test.ts packages/core/tests/scenario-samples.test.ts`
for supported frontmatter, inventory, roster size, title consistency, source labels, compact
controls, and required authoring sections. These checks do not establish generated semantic quality.

Manually review source arithmetic, authority boundaries, unknowns, conditional developments, and
termination criteria. Browser review is user-run. A later small real-model check should use the
configured Ornith model and one low-load example before attempting a multi-world case; do not
run all twelve examples against a local model just to validate edited Markdown.
