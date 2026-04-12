# LLM Roles and Routing

## Current Role Model

The current compiled workflow uses five distinct role slots:

| Role | Primary responsibility | Used in |
| --- | --- | --- |
| `planner` | scenario interpretation, pacing plan, situation bundle, action catalog, coordination frame, cast roster | planning |
| `generator` | actor-card generation from the cast roster | generation |
| `coordinator` | focus planning, background update digestion, step adjudication | runtime coordinator |
| `actor` | one-step action proposals for selected actors | runtime coordinator |
| `observer` | per-step summary, momentum, atmosphere, world digest | runtime observation |

## Routing Model

Configuration is layered in two dimensions:

- provider-level shared tables such as `[llm.openai]` and `[llm.ollama]`
- role-level tables such as `[llm.planner]`, `[llm.coordinator]`, and `[llm.actor]`

Each role resolves to one `ModelConfig`. Provider-specific options are stored alongside the
role config, not behind separate adapter interfaces.

## Important Current Behaviors

### Coordinator Is a First-Class Role

The coordinator is not folded into the planner or observer. It is a separate role in:

- `env.sample.toml`
- `ModelRouterConfig`
- provider routing
- runtime execution

If coordinator-specific settings are missing, the config builder currently copies the
planner model as the coordinator default.

### Current Compiled Runtime Ownership

The runtime graph is intentionally split:

- `coordinator` decides the focus slices and directly selected actors
- `coordinator` summarizes deferred actors through background updates
- `coordinator` adopts actor proposals, updates intent snapshots, advances time, and
  produces a world-state hint
- `observer` summarizes the step, updates `world_state_summary`, and provides
  `momentum` / `atmosphere` for downstream runtime logic

This means time advancement and adjudication belong to the coordinator path in the current
compiled graph, not to the observer path.

## Failure Behavior by Role

| Role or stage | Current behavior |
| --- | --- |
| planner | structured parsing failures are treated as hard failures |
| generator | actor generation is expected to produce valid actor cards or fail |
| coordinator: focus plan | allows default payload fallback |
| coordinator: background updates | allows default empty-batch fallback |
| coordinator: step adjudication | allows default payload fallback |
| actor | allows forced-idle default fallback |
| observer | expected to return a structured report without the same default-fallback path |

## Prompt Ownership

The repository keeps prompt assets as Python modules rather than external text files.

Prompt groups are currently split by workflow area:

- `graphs/planning/prompts`
- `graphs/generation/prompts`
- `graphs/coordinator/prompts`
- `graphs/runtime/prompts`
- `graphs/finalization/prompts`

Some prompt modules exist for decompositions that are not wired into the current compiled
runtime path. The workflow docs describe the compiled path first and should be treated as
the source of truth for execution shape.

## Finalization Role Reuse

The finalization stage reuses the `observer` role for report-writing tasks:

- timeline anchor inference
- timeline section writing
- actor dynamics section writing
- major events section writing
- actor final results section writing
- simulation conclusion writing

Section writers validate the generated markdown shape and retry once before failing.

## Provider Notes

The repository currently models these providers:

- `openai`
- `anthropic`
- `google`
- `bedrock`
- `ollama`
- `vllm`

The sample config demonstrates mixed-role routing, including a local `ollama` actor setup
and OpenAI-backed planner, coordinator, and observer roles.
