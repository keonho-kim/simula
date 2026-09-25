# Operations

## Document extraction tools

Run `bun install` to install the pinned PDF.js and N-API canvas dependencies. Verify
that the target macOS, Linux, or Windows architecture has the matching canvas binary.
PDF text extraction and page rendering run in the server's TypeScript process.
Install LibreOffice for DOCX, DOC, PPTX, and XLSX conversion to PDF; expose `soffice`
on PATH or set `SIMULA_LIBREOFFICE_BIN` to its executable. PDF, CSV, TXT, and MD do
not require LibreOffice. Do not commit workstation-specific executable paths.

Document ingestion is available through `/api/documents`: POST creates a set; POST
`/{setId}/files` accepts one multipart `file`; POST `/{setId}/files/{documentId}/extract`
starts extraction. GET `/{setId}` returns file status, POST
`/{setId}/files/{documentId}/cancel` requests cancellation, and GET
`/{setId}/files/{documentId}/evidence?offset=0` reads up to 100 evidence blocks.

Initial limits are 20 files per set, 20 MiB per file, and 10,000 evidence blocks per
document. CSV uses bounded row/column parsing, with all rows counted and large-file
evidence limited to column statistics plus first/last records; TXT/MD retain native
text offsets. PDF.js pairs each rendered
PDF page with its selectable text for the configured vision-capable `storyBuilder`
model; image-only pages still reach the model with empty extracted text. Extracted
text takes precedence over conflicting visual numbers. Office documents pass through
bounded LibreOffice-to-PDF conversion and the same page pipeline. XLSX additionally
reads original cell values and formulas, distinguishing stored results from missing
cache values; these original values take precedence over LibreOffice recalculation.
DOCX, DOC, and PPTX contribute text extracted from each converted PDF page and the
same page's rendered image. The VLM explains page content; it is not a complete OCR
transcription. Page references identify normalized PDF pages, without original
Office shape positions or coordinates.
Failed visual pages remain explicit coverage gaps.
PDF-page model calls are recorded beside each document, including failed admitted
calls with unknown incurred usage. The analytical report counts this extraction
work once in shared source/scenario preparation; older PDF/Office artifacts without
a call log leave that scope unknown rather than implying zero model work.
See `docs/system-adv-progress.md` and `docs/document-converter-comparison.md`.
Stored evidence and analytical references produced with the retired Docling method
are no longer readable under the current contract. Re-upload the original files and
regenerate the dependent scenario and report artifacts; do not relabel old evidence
as PDF.js or VLM output.

## Local Development

Install dependencies:

```bash
bun install
```

Run the single development server:

```bash
bun run dev
```

The server defaults to `https://localhost:3001`, with the API on the same origin. The generated
development certificate lives outside the repository; trust it in the browser before using OPFS.

## Built Application

From the repository root:

```bash
bun run build
bun run start
```

The root build runs TypeScript checking and a Next.js Webpack build. Keep `.next`, `server.ts`,
`src/backend`, `src/shared`, installed production dependencies, and bundled samples together.
The custom server is not included in Next's `standalone` output, so deploy the source and
dependencies with the build. `start` sets production mode and serves pages, API, SSE, and
WebSocket from one Node.js listener. `PORT` applies to all routes. Use an HTTPS deployment proxy
or provide `SIMULA_TLS_CERT_FILE` and `SIMULA_TLS_KEY_FILE` for direct TLS. Browser SQLite/OPFS
owns completed history; server artifacts are temporary and process-local.

## Scenario Input

A scenario file must start with frontmatter followed by a non-empty body.

```text
---
num_cast: 6
allow_additional_cast: true
actions_per_type: 3
max_round: 8
autonomous_progress: false
fast_mode: false
output_length: short
---
Scenario body starts here.
```

`num_cast` is required. Other controls are optional and default in code. `output_length` accepts
`short`, `medium`, or `long` and also controls actor memory compression length. Unsupported controls
fail explicitly.

Sample scenarios live in [`../senario.samples/`](../senario.samples/README.md).

## Run Lifecycle

The web app normally drives runs:

1. create or load a scenario
2. review scenario controls
3. save role settings
4. create a run with `POST /api/runs`
5. start it with `POST /api/runs/:id/start`
6. stream updates from `GET /api/runs/:id/events`
7. inspect or export the report after completion

The server prevents starting the same run twice in the same process. A second start request for an
already running run returns `already_running`.

## Run Artifacts

Temporary server output while the browser session is active:

```text
<OS temporary workspace>/<run_id>/
  manifest.json
  scenario.json
  events.jsonl
  state.json
  report.md
  graph.timeline.json
```

The durable copy is in the browser profile's SQLite WASM database. Use the landing page backup
controls to move it between profiles or computers. Existing `runs/` directories remain untouched
but are not imported automatically.

| File | Purpose |
| --- | --- |
| `manifest.json` | run id, status, timestamps, stop reason, error, and artifact paths |
| `scenario.json` | normalized scenario used by the run |
| `events.jsonl` | append-only runtime events |
| `state.json` | completed structured simulation state |
| `report.md` | final human-readable report |
| `graph.timeline.json` | replay frames for graph and message inspection |

## Exports

Use the export endpoint for completed runs:

| Query | Output |
| --- | --- |
| `kind=json` | `state.json` |
| `kind=jsonl` | `events.jsonl` |
| `kind=md` | `report.md` |

Unsupported kinds fail with `400`.

## Validation Commands

Run these from the repository root:

```bash
bun test
bun run typecheck
bun run lint
bun run build
```

Browser smoke tests:

```bash
bun run test:e2e
```

## Maintenance Notes

- Keep old `runs/` ignored; new runtime artifacts use an OS temporary directory.
- Keep `output.samples/` as committed reference data only.
- Update workflow docs when stage order or run event behavior changes.
- Update `packages/shared` types and this documentation together when public event or API shapes change.

## Dependency Update Constraints

Direct dependencies were checked against npm stable releases on 2026-09-15. Root and web
workspace declarations use matching versions, with `bun.lock` recording resolved packages.

Two dependencies intentionally remain on the newest compatible release line:

- TypeScript 6.0.3: typescript-eslint 8.70.0 supports `>=4.8.4 <6.1.0`, so TypeScript 7.0.2
  is outside its supported range. See the [supported dependency versions](https://typescript-eslint.io/users/dependency-versions/).
- KaTeX 0.16.47: rehype-katex 7.0.1 depends on `katex ^0.16.0`. Keep the directly imported
  stylesheet on the renderer's version line rather than mixing it with KaTeX 0.18 assets.

Recheck these constraints before a future upgrade. `bun outdated --recursive` lists both
packages as newer upstream releases; this does not mean their current integration supports them.


## Automatic round progression

The first three consecutive successful automatic round approvals each show the five-second
countdown. Subsequent rounds in that streak continue immediately without opening the round
modal. The simulation header retains an auto-continue switch so this mode can be stopped.
Turning auto-continue off, a failed continuation, or selecting/creating another run resets the
streak. The tab session retains the confirmed streak across reloads, together with acknowledged
rounds. Manual approvals do not advance the automatic streak.

## Document-grounded ScenarioBuilder API

After extracting a document set, read its current `revision` and submit
`POST /api/scenario-builder` with a UUID `Idempotency-Key` header and JSON containing
`documentSetId`, `documentRevision`, and optional `context`, `situation`, `language`,
`fastMode`, and `participants`. Each participant contains `name` and optional
`personality`. Presets are `auto`, `meeting`, `presentation`, `negotiation`, and `review`.

Retained participant rows require distinct names or titles. Missing traits are generated;
supplied traits are preserved. The initial API supports up to 12 specified participants
and 32 KiB request bodies. A reused key must have the same normalized request.

| Operation | Endpoint |
| --- | --- |
| Build status and review draft | `GET /api/scenario-builder/:id` |
| Status stream; optionally selected task's live draft | `GET /api/scenario-builder/:id/events?task=:taskId` |
| Accepted task artifact | `GET /api/scenario-builder/:id/task?id=:taskId` |
| Cancel active work | `POST /api/scenario-builder/:id/cancel` |
| Resume using matching accepted tasks | `POST /api/scenario-builder/:id/retry` |
| Confirm against the source revision | `POST /api/scenario-builder/:id/confirm` |

In the completed review, selecting a cited source retrieves one exact block with
`GET /api/documents/:setId/files/:documentId/evidence?id=:blockId&revision=:documentRevision`.
The block ID is scoped to its document. A missing/invalid revision returns 400; a
retained revision returns its original excerpt even when newer materials exist. An
uncaptured revision returns 409 rather than substituting the latest content. The UI loads no excerpt before selection and labels extracted
text separately from page-level VLM interpretation, which is not a full OCR transcript.
Before scenario generation, the server captures the selected ready/partial document set,
its extraction results and recorded document-model calls. Later additions and re-extractions
do not change the captured inputs. Reports for the resulting worlds use that same revision
and display outdated status if the current document set has advanced. Reading a source,
report or export does not create snapshots or start generation. Existing reports remain
readable from their accepted contents; historical source revisions that were never captured
cannot be reconstructed. Generate a new scenario from current materials when necessary.

SSE begins with a snapshot, then task events under one execution ID. Draft sequence
numbers are local to an attempt; a new attempt replaces the prior draft. Draft payloads
contain the current named display fields parsed on the server. Detailed text
is sent only for the selected task. Slow/disconnected readers do not cancel generation;
reconnect for a fresh snapshot. Recent status snapshots retain at most 64 tasks.
Completed text is available through accepted task artifacts and the final draft.

Shared ScenarioBuilder execution uses one process-scoped owner; a duplicate start in that
process does not dispatch duplicate model work. Cancellation signals the current owner and
prevents later task acceptance. Already incurred provider calls remain part of usage history.
If the server stops, unfinished temporary work cannot resume. Browser-saved accepted results
remain available, but a new generation request is required for missing work. Detailed SSE
remains process-local; there is no multi-server routing contract.

Builds use the configured `storyBuilder` model. A missing retained source revision, an
unresolved blocking check, unresolved source-fact audience, or partial extraction
prevents confirmation. This conservative partial extraction gate remains until the UI
can classify and acknowledge coverage gaps.
The review screen shows source claims with their initial public or named-participant
audiences. Scenario records created before the required `sourceFacts` contract need a
new build; older drafts without that field are not silently treated as public.
The home page's **Create from documents** action opens source selection, optional
context/preset/participants, generation, and review. Select files before reading them;
pending selections can be removed. Read failures can be retried individually. Extraction
runs at most two files concurrently, and queued jobs can be canceled. Closing the dialog
stops its live subscription without canceling server generation; reopening restores saved
document/build IDs. After confirmation, **Develop story** prepares one independent
starting state; **Start simulation** hands that state to the existing simulation view.

Shared-scenario calls remain outside an individual run's event log and appear once in
the analytical report's shared-preparation accounting. Multiverse execution uses the
confirmed artifact through the batch API described below. Removing retained uploads
and complete VLM coverage of difficult visual regions remain open work.

## World preparation and launch

`POST /api/worlds` takes a UUID `Idempotency-Key` and JSON with `scenarioId` and
`controls` (`maxRound`, `actionsPerType`, `fastMode`, `autonomousProgress`, `outputLength`).
The shared scenario must already be confirmed. Cast count, identities, and shared
personalities come from that specification; launch input cannot override them.

| Operation | Endpoint |
| --- | --- |
| Preparation status and accepted story | `GET /api/worlds/:id` |
| Status and selected-task field previews | `GET /api/worlds/:id/events?task=:taskId` |
| Accepted task artifact | `GET /api/worlds/:id/task?id=:taskId` |
| Retry failed/canceled preparation | `POST /api/worlds/:id/retry` |
| Cancel preparation | `POST /api/worlds/:id/cancel` |
| Materialize or retrieve its simulation run | `POST /api/worlds/:id/run` |

The materialized run has ID `world-<world UUID>`. Its initial event log includes world
preparation model metrics once, including content-repair calls. Creating it again after
an interrupted handoff reuses the same run and does not duplicate those metrics.

World preparation and launch use the same persisted 30-second ownership lease. A second
runtime observes active preparation and avoids duplicate model calls. While another owner
is preparing or linking the world, a competing launch returns 409; retry after it finishes
to obtain the same run. Both the run directory publication and the world-to-run link check
the current owner. Cancellation before publication keeps the prepared story available
without creating a run. Preparation retries continue to reuse matching accepted units.
Shared ScenarioBuilder cost is not yet included in the run's totals.

Run start is accepted only for a newly created run; a completed run returns
`already_completed`. Other runs with execution history are not silently restarted over
their existing artifacts. Open the stored result or prepare another world. Resuming an
interrupted simulation mid-round still requires the compact-state/checkpoint work; this
limitation is separate from retrying world preparation, which reuses accepted task units.

## Model capacity and explicit cancellation

All production model workflows share the server's endpoint/model admission pools,
including text StoryBuilder, document ScenarioBuilder, world preparation, simulation
roles, memory compression, PDF vision tasks, and report generation. Configure
`concurrency` in LLM settings (default 8, range 1–50); updates take effect without a
restart. Set `SIMULA_MODEL_QUEUE_LIMIT` (default 1024) and
`SIMULA_MODEL_QUEUE_TIMEOUT_MS` (default 120000) before starting the server.

A waiting task has not entered provider generation. New builder detail lists show
**Waiting for model capacity** until admitted. Recorded `queueWaitMs` is separate from
TTFT and model duration, preserving existing throughput calculations. An exhausted
queue or admission timeout fails the affected call explicitly; it does not reduce the
requested world count. Retrying accepted builder tasks still reuses unchanged artifacts.

Simulation and commentary acquire process-scoped run ownership before model work. Event logs,
timeline snapshots, state, Markdown and terminal manifests require that active owner. A call
waiting for model capacity rechecks ownership before contacting its provider. Explicit
cancellation stops queued and active model calls and records `canceled`. Standalone round
approvals are process-local; future-round and inactive requests return 409. Native SSE
reconnection resumes using `Last-Event-ID`; `?after=<run-id>:<byte-offset>` supports
visibility and gap recovery. Invalid or cross-run cursors return 400. Browser SQLite commits
received events before projecting them into the UI, then acknowledges the saved cursor so the
process-local transfer queue can release its confirmed prefix. Closing a single run event subscription
does not cancel the run while browser-session presence remains connected. Losing that presence
for over 30 seconds cancels the session's active work and removes temporary artifacts.
Manual round approval can still leave a run waiting; server-owned automatic batch
continuation is provided by Multiverse controls. Text StoryBuilder is request-owned, so canceling
that draft response aborts its generation. Document/world jobs have independent cancel
endpoints and survive closing their detail subscription.

Provider SDK retries are disabled so one admitted attempt represents one SDK request.
Structured scenario, world-preparation, and analytical tasks share at most three
attempts across content repair and transient transport recovery. Each retry waits
outside admission, follows a bounded Retry-After hint when present, then reacquires
capacity. Authentication/configuration failures and cancellation do not retry.
Existing simulation-role content repairs remain explicit; this structured-task policy
does not add automatic transport retries to every role.
An endpoint may continue internal computation after client cancellation; the application
guarantees local stream cancellation and suppression of late output, not remote hardware
preemption. Multiple Bun processes do not share the in-memory allowance.

## Multiverse batches

After confirming a document scenario, enable **Multiverse** in the launch panel. Select
1–50 worlds, common simulation controls, automatic progression, and the elapsed execution
time limit. The initial defaults are five worlds and 60 minutes; the visible limit can
be configured between 1 and 1440 minutes for this execution. It includes preparation
and manual approval waits. Deadline exhaustion stops unfinished worlds and preserves
completed results; it is identified separately from explicit user cancellation.

The source scenario is generated once. All selected worlds begin independent StoryBuilder
workflows. Model calls remain subject to the configured endpoint/model allowance; selecting
50 worlds does not silently reduce the world count to that allowance.

`POST /api/multiverse` requires a UUID `Idempotency-Key` and a body containing `scenarioId`,
`controls`, `worldCount`, `autoContinue`, and `maxDurationMinutes`. Defaults are normalized
before idempotency comparison. Reusing the key with different input returns a conflict.

| Operation | Endpoint |
| --- | --- |
| Compact batch/world status | `GET /api/multiverse/:id` |
| Retry unfinished preparation with existing world IDs | `POST /api/multiverse/:id/resume` |
| Stop all unfinished worlds | `POST /api/multiverse/:id/cancel` |
| Stop one world | `POST /api/multiverse/:id/worlds/:worldId/cancel` |
| Change one world's automatic progression | `POST /api/multiverse/:id/worlds/:worldId/automatic`, body `{ "enabled": true }` |
| Approve one exact waiting round | `POST /api/multiverse/:id/worlds/:worldId/continue`, body `{ "roundIndex": 1 }` |

Automatic rounds continue while the browser tab stays connected. The first three automatic
approvals wait five seconds; later approvals have no countdown until automatic progression
is disabled. A manual command affects only the selected world. Use the Multiverse panel
to control a batch world rather than the individual run's browser-owned approval dialog.

Batch status is completed only when every world completes. Mixed terminal outcomes are
partial; the UI lists completed, failed, canceled, and interrupted counts separately.
Shared scenario generation usage and cross-world report generation are not yet aggregated.
Batch worlds retain their ordinary run records and deterministic report artifacts, but
do not automatically request one long commentary per world.

Batch execution owns a process-scoped lease. A competing start in the same Bun process
does not dispatch duplicate worlds. Cancel and deadlines signal descendant preparation,
models and round waits. World-specific mode, approval and cancel commands are accepted
by the owning server process. Mode/approval endpoints return 202 accepted; GET status
shows the applied result. The supervisor processes the ordered inbox immediately.
Only the current waiting round can receive a new manual approval. Repeating that approval
does not advance another round. Rapid mode changes retain their order; canceling one world
does not stop siblings. At most 150 progress commands and one reserved cancellation per
world may remain pending; a full progress queue returns a conflict so the caller can retry.
Commands belong to the current execution generation. After interruption and explicit
recovery, issue controls again rather than assuming old pending approvals were inherited.

After a server restart and lease expiration, unfinished work is exposed as interrupted.
Retrying preparation reuses matching accepted tasks and preserves world IDs.
Completed worlds are not rerun. Simulations interrupted mid-round retain their histories
and are marked interrupted; this implementation does not yet resume their graph checkpoint.
Durable ownership alone does not qualify a multi-server deployment: shared admission,
restartable round/countdown checkpoints, provisional streams and target-filesystem validation remain.

## Analytical report API

The analytical backend is available for terminal individual runs and terminal Multiverse
batches. The Report page now shows a single-page analysis workspace. Select **Generate
analysis** to start, or reopen a saved analysis without additional model calls. A run
owned by a batch can switch to **Analyze this Multiverse**; generation still requires
that every world is terminal.

`POST /api/analysis` accepts a UUID `Idempotency-Key` header and a JSON body containing
`subject: { kind: "run" | "batch", id: "..." }`. It resolves the exact source revision
before creating work. A changed source requires a new report ID; replaying an existing
ID cannot silently replace its original input. Generation uses the configured Observer.

| Operation | Endpoint |
| --- | --- |
| Discover latest report for a subject | `GET /api/analysis?kind=run&subject=:runId` (or `kind=batch`) |
| Read saved report/status | `GET /api/analysis/:id` |
| Resume generation with matching accepted tasks | `POST /api/analysis/:id/retry` |
| Cancel active generation | `POST /api/analysis/:id/cancel` |
| Task statuses and selected live fields | `GET /api/analysis/:id/events?task=:taskId` |
| Accepted task artifact | `GET /api/analysis/:id/task?id=:taskId` |
| Source/simulation excerpt scoped to the report | `GET /api/analysis/:id/reference?id=:referenceId` |
| Report-generation call metrics | `GET /api/analysis/:id/metrics` |
| Shared/world/report resource accounting | `GET /api/analysis/:id/accounting` |
| Portable accepted analysis snapshot | `GET /api/analysis/:id/export?kind=json` |

Discovery returns `{ analysis: null, freshness: null }` when no report exists. Otherwise,
freshness is `current`, `outdated`, or `unavailable`. The last value means that the current
source snapshot cannot be resolved, including a missing source or a now-active subject;
it is not permission to treat the old report as current. Discovery/read operations make
no model calls and preserve results already copied into browser storage. Server lookup pointers
are temporary and do not survive process restarts.

Reports include nine sections: four SWOT branches, trajectories, actors, materials,
scenario assessment, and conclusion. Each section retains evidence references. Unknown
SWOT influence remains null; trajectory frequencies count eligible worlds. Failed or
missing input branches yield partial results rather than fabricated conclusions.

Each execution attempt has a 60-minute deadline and a 4,096-call ceiling. Budget stops
are recorded distinctly from user cancellation. Completed simulation artifacts remain
untouched when report generation fails. Accepted task files can be reused on retry;
report execution and accepted report artifacts require process-scoped ownership. A second
runtime is not supported. After a server restart, unfinished temporary work is lost; saved
browser results remain readable, and a new explicit request may regenerate missing analysis.
Full mid-task resume is not implemented. These ownership checks do not establish target-model
quality or production throughput evidence.

The live report shows **Evidence review → Analysis → Overall assessment**, with at most
three visible task output columns and independent scrolling. Opening a prior stage does
not cancel ongoing work. Task retries replace draft text; accepted report prose survives
failed retries. Validated SWOT scores drive the radar; unknown axes remain unassessed.

Completed cards open large read-only dialogs with source excerpts. Recorded simulation
entries preserve relationship heatmaps/network replay, round browsing, and conversation
history. The former report tabs are removed. Existing stored commentary remains readable.
The four metric cards explicitly cover the selected run plus this report's generation
calls. A separate card on terminal analyses shows recorded shared preparation,
all worlds, each world, final analysis, and overall scope; missing usage stays `—`.
It loads once after the analysis stops rather than scanning every world on each live
render. The report export menu retains
run JSON/JSONL/Markdown downloads and adds analytical JSON and Markdown downloads.
The portable JSON snapshot (format version 2) includes report and source revision IDs,
content digest, current source status, all accepted sections, rubric assessments, cited
source excerpts and locators, world coverage, raw analytical call metrics, and scoped
resource accounting. Shared source-extraction and ScenarioBuilder calls appear once; each world uses its
run log, including world preparation calls already copied into that log. A world
without a run uses its preparation record. Missing logs and absent provider usage
remain unavailable rather than becoming zero.
It omits provider settings and machine-local paths. A partial report lists its failed
sections; a missing cited excerpt fails the export rather than silently dropping it.
An accepted snapshot can still be downloaded if its current source is outdated or
unavailable. The browser renders Markdown from that same validated JSON snapshot and
escapes untrusted source/model text. Both download forms are read-only and initiate no
model calls. The raw `metrics` list covers analysis generation only; `accounting`
separates shared preparation, per-world work, analysis generation, and their recorded
overall total. Admitted provider requests that failed before returning metrics count
as observed calls with unknown incurred tokens and duration. Legacy artifacts lacking
failure coverage remain unknown rather than appearing as complete cost totals.
