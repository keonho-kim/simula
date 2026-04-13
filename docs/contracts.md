# Contracts

## Public Graph Input

The root graph accepts a compact `SimulationInputState`.

| Field | Meaning |
| --- | --- |
| `run_id` | stable identifier for one run |
| `scenario` | cleaned scenario body without YAML frontmatter |
| `scenario_controls` | parsed scenario authoring controls (`num_cast`, `allow_additional_cast`) |
| `max_rounds` | runtime stop ceiling |
| `rng_seed` | deterministic seed derived before graph execution |

`checkpoint_enabled` is not part of the public input. It is injected during hydration from
runtime settings.

## Internal Workflow State

`SimulationWorkflowState` is the fully hydrated internal state. Every active field is required,
and absence is represented with explicit empty values such as `""`, `[]`, or `{}`.

### Planning and cast

- `planning_analysis`
- `plan`
- `actors`
- `pending_cast_slots`
- `cast_slot`
- `generated_actor_results`

### Runtime activity and feeds

- `activity_feeds`
- `activities`
- `latest_round_activities`
- `observer_reports`
- `background_updates`
- `latest_background_updates`

### Runtime coordination and intent

- `focus_candidates`
- `round_focus_history`
- `selected_actor_ids`
- `deferred_actor_ids`
- `actor_intent_states`
- `intent_history`
- `round_focus_plan`
- `round_time_advance`
- `round_time_history`
- `actor_proposal_task`
- `pending_actor_proposals`

### Runtime lifecycle and metrics

- `round_index`
- `simulation_clock`
- `stop_requested`
- `stop_reason`
- `world_state_summary`
- `parse_failures`
- `forced_idles`
- `stagnation_rounds`
- `planning_latency_seconds`
- `generation_started_at`
- `generation_latency_seconds`
- `current_round_started_at`
- `last_round_latency_seconds`

### Finalization artifacts

- `final_report`
- `llm_usage_summary`
- `simulation_log_jsonl`
- `report_projection_json`
- `report_timeline_anchor_json`
- `final_report_sections`
- `final_report_markdown`
- `errors`

## Public Graph Output

The root graph returns `SimulationOutputState`.

| Field | Meaning |
| --- | --- |
| `run_id` | completed run identifier |
| `final_report` | structured report payload |
| `llm_usage_summary` | deterministic LLM usage summary for the completed run |
| `final_report_markdown` | rendered Markdown report |
| `simulation_log_jsonl` | newline-delimited event log |
| `stop_reason` | final stop reason string |
| `errors` | accumulated explicit errors/default notices |

## Structured LLM Contracts

All active structured outputs are required-only. There are no optional response fields in the
active prompt-facing contracts.

| Stage | Contract |
| --- | --- |
| planning | `PlanningAnalysis`, `ExecutionPlanBundle` |
| generation | `ActorCard` |
| runtime round planning | `RoundDirective` |
| runtime actor turn | `ActorActionProposal` |
| runtime round resolution | `RoundResolution` |
| finalization anchor | `TimelineAnchorDecision` |
| finalization report bundle | `FinalReportSections` |

## Artifact Contracts

### `final_report`

Structured summary of the completed run, including scenario, objective, elapsed time, round
count, activity totals, visibility counts, notable events, explicit errors, and LLM usage summary.

### `simulation_log_jsonl`

Ordered event stream containing:

- simulation start
- finalized plan
- finalized actors
- round focus selection
- round time advancement
- background updates
- adopted actions
- observer reports
- final report
- LLM usage summary

### `final_report_sections`

Intermediate structured bundle used to render the final Markdown report. It contains:

- `conclusion_section`
- `actor_results_rows`
- `timeline_section`
- `actor_dynamics_section`
- `major_events_section`

## Failure Policy

- Planning and generation are strict structured calls. If the contract cannot be satisfied, the
  run fails instead of silently degrading.
- Runtime actor proposals, round directives, and round resolutions may use explicit default payloads.
  When that happens, the event is recorded through `errors`.
- Final report section writing retries once with validation feedback. It does not silently
  substitute a synthetic report bundle.
