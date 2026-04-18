# Contracts

## Public Graph Surfaces

The root graph exposes three state surfaces.

| Surface | Purpose |
| --- | --- |
| `SimulationInputState` | compact public input accepted by the root graph |
| `SimulationWorkflowState` | fully hydrated internal state used between nodes |
| `SimulationOutputState` | compact public output returned by the root graph |

This separation matches the current LangGraph graph API pattern of narrow input/output schemas with
a richer internal state.

## Public Input

`SimulationInputState` contains:

| Field | Meaning |
| --- | --- |
| `run_id` | stable identifier for one run |
| `scenario` | scenario body with frontmatter removed |
| `scenario_controls` | parsed scenario controls from frontmatter |
| `max_rounds` | configured runtime hard ceiling |
| `rng_seed` | deterministic seed derived before graph execution |

`checkpoint_enabled` is not part of public input. It is injected during hydration from runtime
settings.

## Public Output

`SimulationOutputState` contains:

| Field | Meaning |
| --- | --- |
| `run_id` | completed run identifier |
| `final_report` | structured final report payload |
| `llm_usage_summary` | deterministic usage summary from the completed run |
| `final_report_markdown` | rendered markdown report |
| `simulation_log_jsonl` | newline-delimited runtime event log |
| `stop_reason` | final stop enum: `""`, `no_progress`, or `simulation_done` |
| `errors` | accumulated explicit default notices and validation drops |

## Runtime Context Contract

`WorkflowRuntimeContext` carries services that should not live in graph state:

- `settings`
- `store`
- `llms`
- `logger`
- `llm_usage_tracker`
- `run_jsonl_appender`

Nodes read these services through LangGraph runtime context instead of smuggling them through the
state dictionary.

Implementation notes:

- log-context normalization lives in `simula.shared.logging.llm`
- run-scoped JSONL append writes live in `simula.shared.io.run_jsonl`

## Internal Workflow State

`SimulationWorkflowState` is required-only. Empty values are represented explicitly with `""`,
`[]`, and `{}` rather than optional keys.

### Core execution

- `run_id`
- `scenario`
- `scenario_controls`
- `max_rounds`
- `planned_max_rounds`
- `checkpoint_enabled`
- `rng_seed`

### Planning and generation

- `planning_analysis`
- `plan`
- `pending_cast_slots`
- `cast_slot`
- `generated_actor_results`
- `actors`
- `generation_started_at`
- `generation_latency_seconds`

### Runtime trace

- `activity_feeds`
- `activities`
- `latest_round_activities`
- `observer_reports`
- `focus_candidates`
- `round_focus_history`
- `selected_cast_ids`
- `deferred_cast_ids`
- `latest_background_updates`
- `background_updates`
- `round_focus_plan`
- `time_advance`
- `simulation_clock`
- `round_time_history`
- `round_index`
- `current_round_started_at`
- `last_round_latency_seconds`

### Event and intent tracking

- `event_memory`
- `event_memory_history`
- `actor_intent_states`
- `intent_history`
- `actor_facing_scenario_digest`
- `actor_proposal_task`
- `pending_actor_proposals`

### Lifecycle and counters

- `stop_requested`
- `stop_reason`
- `world_state_summary`
- `parse_failures`
- `forced_idles`
- `stagnation_rounds`
- `planning_latency_seconds`
- `errors`

### Finalization

- `final_report`
- `llm_usage_summary`
- `simulation_log_jsonl`
- `report_projection_json`
- `report_timeline_anchor_json`
- `report_conclusion_section`
- `report_timeline_section`
- `report_actor_dynamics_section`
- `report_major_events_section`
- `final_report_sections`
- `final_report_markdown`

## Structured LLM Contracts

All active structured outputs are required-only. Missing data is represented through explicit empty
values in workflow state, not through optional response fields.

| Stage | Contract |
| --- | --- |
| planning | `PlanningAnalysis`, `ExecutionPlanBundle` |
| generation | `GeneratedActorCardDraft` |
| runtime continuation | `RoundContinuationDecision` |
| runtime directive | `RoundDirective` |
| runtime actor turn | `ActorActionProposal` |
| runtime resolution | `RoundResolution` |
| finalization anchor | `TimelineAnchorDecision` |

Finalization section writers are text outputs with validators, not active structured Pydantic
schemas.

## Durable Artifacts

### `plan`

The persisted plan contains:

- `interpretation`
- `situation`
- `progression_plan`
- `action_catalog`
- `coordination_frame`
- `cast_roster`
- `major_events`

Important details:

- `planned_max_rounds` is copied from `planning_analysis.progression_plan.max_rounds`
- `finalize_plan` validates cast uniqueness
- `finalize_plan` validates `major_events` round windows and participant cast ids

### `event_memory`

Shared runtime memory for planner-defined major events. It tracks:

- event status
- next and overdue event ids
- completed and missed event ids
- whether unresolved required events keep the endgame gate open

### `event_memory_history`

Append-only event-memory transitions. Each record stores:

- `round_index`
- `source`
- `event_updates`
- `event_memory_summary`
- `stop_context`

Current `source` values are:

- `resolve_round`
- `continuation_hard_stop`
- `continuation_stale_required_stop`

### `final_report`

Structured summary of the completed run, including scenario framing, elapsed simulation time,
round count, activity totals, notable events, explicit errors, and LLM usage summary.

### `report_projection_json`

Persistent finalization projection used by report-section writers. It is built after the final
structured report exists and includes the final event state plus the recorded history needed to
explain how the run arrived there.

### `final_report_sections`

Intermediate string bundle used to render markdown. It contains:

- `conclusion_section`
- `actor_results_rows`
- `timeline_section`
- `actor_dynamics_section`
- `major_events_section`

The workflow also stores each section string separately before render time.

### `simulation_log_jsonl`

`simulation.log.jsonl` is an ordered append-only event stream. Each row includes:

- `index`
- `event`
- `event_key`
- `run_id`

Current event families are:

- `simulation_started`
- `llm_call`
- `plan_finalized`
- `actors_finalized`
- `round_focus_selected`
- `round_background_updated`
- `time_advanced`
- `round_actions_adopted`
- `round_observer_report`
- `round_event_memory_updated`
- `final_report`
- `llm_usage_summary`

Notes:

- `event_key` is used to avoid duplicate append writes
- `round_actions_adopted` is written only when a round actually adopts activities
- raw LLM call rows include prompt text, merged raw response text, timing, token counts, and
  structured `log_context`

## Failure and Default Policy

- planning and generation are strict structured calls and fail when the contract cannot be satisfied
- runtime continuation, directive, actor proposal, and resolution nodes may use explicit default
  payloads when parsing or validation fails
- defaulted runtime behavior remains observable through `errors`
- invalid adopted proposals are dropped explicitly and recorded in `errors`
- required unresolved major events can keep the runtime alive past the planner target until the
  hard ceiling is reached
- final report section writing retries once with validation feedback instead of silently inserting
  synthetic filler text

## Related Docs

- execution boundaries: [`architecture.md`](./architecture.md)
- model routing and retries: [`llm.md`](./llm.md)
- stage-level producers of these artifacts: [`workflows/README.md`](./workflows/README.md)
