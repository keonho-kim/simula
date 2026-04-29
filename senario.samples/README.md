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

Example:

```text
---
num_cast: 8
allow_additional_cast: true
max_round: 8
output_length: short
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
