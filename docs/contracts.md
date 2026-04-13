# Contracts

## Public Graph Input

The root graph accepts a compact `SimulationInputState`.

| Field | Meaning |
| --- | --- |
| `run_id` | stable identifier for one run |
| `scenario` | raw scenario text |
| `max_steps` | runtime stop ceiling |
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
- `latest_step_activities`
- `observer_reports`
- `background_updates`
- `latest_background_updates`

### Runtime coordination and intent

- `focus_candidates`
- `step_focus_history`
- `selected_actor_ids`
- `deferred_actor_ids`
- `actor_intent_states`
- `intent_history`
- `step_focus_plan`
- `step_time_advance`
- `step_time_history`
- `actor_proposal_task`
- `pending_actor_proposals`

### Runtime lifecycle and metrics

- `step_index`
- `simulation_clock`
- `stop_requested`
- `stop_reason`
- `world_state_summary`
- `parse_failures`
- `forced_idles`
- `stagnation_steps`
- `planning_latency_seconds`
- `generation_started_at`
- `generation_latency_seconds`
- `current_step_started_at`
- `last_step_latency_seconds`

### Finalization artifacts

- `final_report`
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
| runtime step planning | `StepDirective` |
| runtime actor turn | `ActorActionProposal` |
| runtime step resolution | `StepResolution` |
| finalization anchor | `TimelineAnchorDecision` |
| finalization report bundle | `FinalReportSections` |

## Artifact Contracts

### `final_report`

Structured summary of the completed run, including scenario, objective, elapsed time, step count,
activity totals, visibility counts, notable events, and explicit errors.

### `simulation_log_jsonl`

Ordered event stream containing:

- simulation start
- finalized plan
- finalized actors
- step focus selection
- step time advancement
- background updates
- adopted actions
- observer reports
- final report

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
- Runtime actor proposals, step directives, and step resolutions may use explicit default payloads.
  When that happens, the event is recorded through `errors`.
- Final report section writing retries once with validation feedback. It does not silently
  substitute a synthetic report bundle.
