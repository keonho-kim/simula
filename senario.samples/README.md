# senario.samples

Sample scenario seeds for local Simula runs.

The directory name is intentionally `senario.samples` because current code and documentation point
to that path.

## Files

| File | Focus |
| --- | --- |
| `01_consumer_marketing_launch.md` | consumer marketing launch and target-segment conversion |
| `02_wargame_iran_us.md` | U.S.-Iran current-affairs war game |
| `03_startup_boardroom_crisis.md` | startup boardroom conflict and survival decisions |
| `04_city_hall_disaster_response.md` | city hall disaster response and stabilization |
| `05_korean_enterprise_promo_approval_conflict.md` | Korean enterprise approval conflict over a promotion |
| `06_new_technology_internal_conflict.md` | internal politics around new-technology development |
| `07_relationship_triangle_conflict.md` | three-person friendship and romantic-confession conflict |
| `08_family_clinic_care_decision.md` | family and neighborhood clinic care decision |
| `09_apartment_redevelopment_committee.md` | apartment redevelopment committee and tenant negotiation |
| `10_regional_bank_social_media_run.md` | regional bank liquidity rumor and deposit run |
| `11_airport_weather_disruption_command.md` | airport snow disruption and multi-party operations command |
| `12_hospital_network_ransomware_coordination.md` | hospital network ransomware response and care continuity |

## Frontmatter

Each sample must start with flat YAML-style frontmatter.

Required:

- `num_cast`: positive integer requested cast count

Optional:

- `allow_additional_cast`: boolean, defaults to `true`
- `actions_per_type`: positive integer, defaults to `3`
- `max_round`: positive integer, defaults to `8`
- `fast_mode`: boolean, defaults to `false`
- `actor_context_token_budget`: positive integer, uses the actor role default when omitted
- `output_length`: `short`, `medium`, or `long`; defaults to `short`
- `load_level`: `low`, `middle`, or `high`; defaults to `middle`

Load levels describe the expected operational pressure of the sample:

- `low`: small relationship or care decisions with short interaction chains
- `middle`: organizational coordination across a moderate cast and a few stakeholder groups
- `high`: many actors, dense operational pressure, or multi-channel public/private escalation

Example:

```text
---
num_cast: 8
allow_additional_cast: true
max_round: 8
output_length: short
load_level: middle
---
```

Unsupported controls fail explicitly during scenario parsing.

## Authoring Rules

- Keep samples driven by actor disposition and decision pressure, not long backstory.
- Use one compact cast section per sample.
- Keep each actor blurb concrete: who the actor is, what they publicly signal, and how that affects likely behavior.
- For consumer marketing samples, keep awareness, favorability, trial, purchase, and repeat purchase distinct.
- For current-affairs war-game samples, pin the setup to an explicit as-of date and real political constraints.
- For corporate or governance samples, keep approval authority, disclosure duty, and stakeholder pressure explicit.
