# Retained-memory Ornith qualification

Date: 2026-09-23. Scope: W01 retained-memory extraction and closure, not a full simulation
or a general model benchmark. Run explicitly with:

```sh
bun scripts/qualify-memory.ts
```

The runner requires local LM Studio with `ornith-1.5-35b-a3b` already loaded. It uses an
isolated actor-role configuration and a loopback observation proxy that forwards real
requests/responses unchanged; no mock completion is used. Outputs are new JSON files
under ignored `output/qualification/`. An optional first argument selects a new result
path, which must not already exist. Saved user settings are not modified.

## Input and configuration

- Fixture: [memory-retention.json](../sample-input-items/memory-retention.json), synthetic Korean text.
- Fixture SHA-256: `811170e183b044ce79c800fa731f87d4fcc06922ba3af6163ec6b816b75e8eef`.
- Base commit: `996b28188eea13e794ca3c87437a0cfdca4df018`; dirty worktree: `true`. This is not a release certification.
- Model: `ornith-1.5-35b-a3b`, Q4_K_M; loaded context 85,248, server parallel setting 1.
- Actor output ceiling 768 tokens, temperature 0, `reasoning_effort: none`.
- Application admission 1, fast mode off, per-call timeout 60 seconds, runner deadline
  10 minutes and maximum 100 observed requests. Server version was not recorded.
- Same current prompts/configuration and initial actors for both paths. The baseline
  executes the existing per-actor operation separately; the comparison uses batched
  shared extraction/closure. This is not a checkout-to-checkout historical benchmark.

## Results

An initial actual-model run failed the cost gate: 24 individual requests versus 25
shared requests. Completed-action text also produced an active record. This result was
retained, not counted as successful optimization. Sharing identical closure inputs and
clarifying active-versus-completed records fixed the observed case.

| Final public comparison | Individual path | Shared path |
| --- | ---: | ---: |
| Model requests, including retries | 24 | 9 |
| Shared-addition requests | 0 | 6 |
| Closure-only requests | 0 | 3 |
| Elapsed time | 27.81 s | 8.25 s |
| Active records after explicit fulfillment and routine remarks | 0 per reader | 0 per reader |

The shared path performs five logical extraction tasks and two logical closure tasks;
the observed requests include repair attempts. The public comparison reduced requests
by 62.5% in this fixture. A preceding successful iteration measured 24 versus 9 requests
and 27.76 versus 8.30 seconds; the final run added an explicit deadline-preservation check.
Run order was individual then shared, so caching/warm state can affect timing. Do not
claim a general latency percentage, p95, or multi-world throughput from these observations.

All final live checks passed:

- Four permitted readers retain the stated budget promise, including its deadline.
- An unrelated remark does not close it; explicit delivery does.
- Routine/finished actions do not create new active obligations in this fixture.
- Replaying accepted history makes no additional request.
- A private promise reaches only its recipient, survives an unrelated public remark,
  and is absent from shared extraction input and outsiders' ledgers.
- A later accepted public disclosure reaches all readers.

The complete final runner made 38 requests: 24 baseline, 9 shared, and 5 additional
privacy/disclosure requests. Author-specific processing and ordinary memory compression
were excluded equally from the public comparison; they still contribute to real-world
execution costs. Differing private ledgers are deliberately not merged to force savings.

## Verification and remaining limits

Six pure grouping/parser/reducer tests passed. Typecheck, lint and backend/web build
passed. The actual-model functional runner passed. The previous mock browser/full-suite
baseline was not rerun or relabeled as Ornith end-to-end validation in this task.

Long-run retention capacity, semantic accuracy beyond this small corpus, all role/world
interactions, recovery and VDI resource behavior remain separate qualification gates.
Task-local aliases and matching source identities are not a permission to share private
knowledge between worlds or readers with different evidence.
