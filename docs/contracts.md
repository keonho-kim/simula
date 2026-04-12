# Contracts

## Configuration Merge Contract

Settings are built from four layers in this order:

1. defaults
2. `env.toml`
3. environment variables
4. CLI overrides

At load time the repository flattens structured TOML into internal env-style keys, merges
real environment variables, then applies CLI overrides.

## Key Runtime Settings

| Field | Meaning |
| --- | --- |
| `runtime.max_steps` | hard cap for runtime steps |
| `runtime.max_actor_calls_per_step` | upper bound for directly called actors in one step |
| `runtime.max_focus_slices_per_step` | upper bound for coordinator focus slices |
| `runtime.max_recipients_per_message` | limit for routed activity targets |
| `runtime.enable_checkpointing` | enables checkpointer-backed graph compilation |
| `runtime.rng_seed` | optional deterministic seed override |
| `storage.provider` | `sqlite` or `postgresql` |
| `storage.output_dir` | directory used by the presentation layer for file outputs |

### Removed Time Inputs

The fixed-time settings `time_unit` and `time_step_size` are intentionally rejected. The
current runtime supports only `max_steps` as a direct time-related setting.

## State Channel Groups

### Planning and Shared Inputs

| Channel | Meaning |
| --- | --- |
| `scenario` | raw scenario text |
| `plan` | persisted planning result bundle |
| `progression_plan` | planner-selected dynamic time policy |
| `action_catalog` | scenario-wide action menu |
| `coordination_frame` | planner-produced runtime guidance |

### Generation

| Channel | Meaning |
| --- | --- |
| `pending_cast_slots` | fan-out work items for actor generation |
| `generated_actor_results` | slot-level generator results |
| `actors` | finalized actor registry |

### Runtime

| Channel | Meaning |
| --- | --- |
| `activity_feeds` | mailbox-like visibility feeds per actor |
| `activities` | canonical activity log |
| `latest_step_activities` | activities adopted in the current step |
| `focus_candidates` | compressed coordinator candidate pool |
| `step_focus_plan` | selected focus slices for the current step |
| `step_focus_history` | historical focus plans |
| `selected_actor_ids` | actors called directly in the current step |
| `deferred_actor_ids` | actors summarized through background updates only |
| `latest_background_updates` | deferred-actor digest for the current step |
| `background_updates` | accumulated deferred-actor digest history |
| `actor_intent_states` | latest intent snapshots |
| `intent_history` | step-level intent history |
| `pending_step_time_advance` | normalized time-advance record for the current step |
| `simulation_clock` | cumulative time snapshot |
| `step_time_history` | historical time-advance records |
| `observer_reports` | per-step observer summaries |
| `world_state_summary` | current world digest used across steps |
| `stagnation_steps` | low-momentum accumulation counter |
| `stop_requested` / `stop_reason` | runtime stop flags |

### Finalization

| Channel | Meaning |
| --- | --- |
| `final_report` | structured final report JSON |
| `simulation_log_jsonl` | rendered log string in JSONL form |
| `report_timeline_anchor_json` | absolute anchor for report timestamps |
| `report_projection_json` | report-specific projection over runtime state |
| `report_*_section` | generated markdown section bodies |
| `final_report_markdown` | final markdown report assembled in-state |

## Structured Output Surface

### Planning Outputs

- `ScenarioInterpretation`
- `RuntimeProgressionPlan`
- `SituationBundle`
- `ActionCatalog`
- `CoordinationFrame`
- `CastRosterItem`

### Generation and Runtime Outputs

- `ActorCard`
- `StepFocusPlan`
- `BackgroundUpdateBatch`
- `ActorActionProposal`
- `CanonicalAction`
- `StepAdjudication`
- `ActorIntentSnapshot`
- `ObserverReport`
- `SimulationClockSnapshot`
- `StepTimeAdvanceRecord`

### Finalization Outputs

- `FinalReport`
- `TimelineAnchorDecision`

## Persistence Contract

Structured artifacts are persisted through the app store:

| Stored artifact | Meaning |
| --- | --- |
| `runs` | run metadata and status |
| `plan` | persisted planning bundle |
| `actors` | finalized actor registry |
| `activities` | canonical activities |
| `observer_reports` | per-step observer summaries |
| `final_reports` | structured final report JSON |

Human-facing files are written separately after the workflow completes:

- `output/<run_id>/simulation.log.jsonl`
- `output/<run_id>/final_report.md`

## Failure Contract

The repository does not treat all roles the same.

- planning structured generation is expected to succeed without silent degradation
- generation is expected to return a valid actor registry or fail
- coordinator nodes can fall back to default payloads for focus planning, background
  updates, and step adjudication
- actor proposals can fall back to a forced idle/default action path
- observer summaries are expected to succeed without the same default-fallback path
- config validation and storage shape mismatches fail explicitly

For role-by-role details, see [`llm.md`](./llm.md).
