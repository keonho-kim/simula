# System Advancement Historical Work Ledger

Current status and next tests: [System-Adv.md](../System-Adv.md).
Detailed contracts: [system-adv-specification.md](./system-adv-specification.md).
Rules: [AGENTS.md](../AGENTS.md).

This is a chronological record, not the active implementation checklist. Each task's
completion statements, remaining work, model names and test counts describe that task's
historical state. Later work may supersede them. Current status and test order live only
in System-Adv.md; passing a lower-level test does not establish full-feature completion.

**Current model policy:** use local LM Studio `ornith-1.5-35b-a3b` for real inference.
Gemma appears below as historical testing only and must not be selected automatically.
The latest complete deterministic/browser suite baseline is Task 54: 456 tests passed, one Office integration skipped,
typecheck/lint/build passed, and all 31 browser tests passed. No real model was called
in that task. Tasks 55–57 add actual Ornith module qualification and focused/static checks,
not a new full-suite or browser qualification.

## Work ledger

### Task 59: choose Planner event audiences by roster number

- Replaced the event-audience JSON response with `0`, `?`, or comma-separated actor
  numbers. The Planner's code converts them to real actor IDs before persistence.
  Existing event filtering and accepted-sibling storage remain in place.
- Two focused parser tests and the real Ornith runner passed. The current fixture needed
  ten actual calls, including three one-time format repairs, three expected unresolved
  attempts and one corrected-event call. See [the updated record](./event-audience-qualification.md).
- This proves only the event-assignment module; the full simulation remains unverified.

### Task 58: build ScenarioBuilder source audiences from per-fact indexed choices

- One model response now selects the audience for one grounded claim: `0`, `?`, or
  participant numbers. The program resolves numbers to confirmed IDs and retains exact
  source wording and citations in its final JSON. Accepted facts are separate task
  artifacts and a checker can retry only the named fact.
- Generation tasks gained a direct finite-choice response path with the existing
  admission, streaming, output-completion, retry and accepted-task storage boundaries.
- Focused deterministic checks cover parser limits, repair and scenario assembly.
  A tiny live Ornith fixture passed: three calls including a targeted recheck, zero
  calls on accepted replay, and correct private/public audiences. This is module
  evidence, not full ScenarioBuilder or browser acceptance. See
  [qualification record](./source-access-choices-qualification.md).


### PoC scope reset — 2026-09-23

The active plan now targets feature completion on small Ornith inputs. Earlier W01–W12
work IDs remain historical; they are not mandatory PoC gates. Model output moves toward
small stepwise answers accumulated in LangGraph state, with JSON assembled by code.
This planning update did not implement that migration or run new model tests.

### Task 57: assign Planner event audiences against the generated roster

- Added a Planner-owned audience parser, purpose-specific prompt and assignment use case.
  The root graph invokes it after Generator and before Coordinator. Public output becomes
  explicit actor IDs; unknown, duplicate, empty and unresolved recipients fail validation.
- Per-event output repair is bounded to three attempts and 384 output tokens. Fast Mode
  shares existing admission while acceptance writes are serialized. All siblings settle
  before failure returns; persisted accepted events are reusable without regeneration.
- The final actual Ornith fixture passed with seven requests: three successful classifications,
  three expected unresolved attempts, and one corrected-event retry. Canonical storage
  reopening, private injection filtering and invalid stored-grant rejection passed.
- Two pure parser tests passed. Typecheck, lint and backend/web build passed. Existing
  deterministic model support was extended for its new stage but mock functional/browser
  suites were not run or presented as current acceptance. See
  [qualification details](./event-audience-qualification.md).
- W02 remains partial for upstream semantic public-prose safety and whole-world acceptance.
  Targeted module reuse does not close W04 durable resume or expose a retry UI.

### Task 56: complete the world source-access module with isolated public/private generation

- Re-read the governing documents and inspected the partially connected source grants.
  Reused existing world/actor fact projections rather than replacing them. The live Ornith
  runner first reproduced a restricted fact entering the public participant task after two
  model calls. The failed artifact was retained.
- Split public starting positions and private concerns into separate tasks and checks.
  Public work receives public facts and identity/authority; private work receives only the
  owner's facts/profile. Paired task references retain participant identity and independent
  artifact/retry ownership. Public work cannot consume private-check feedback.
- Added fail-fast public-premise checks for direct restricted text and restricted-only
  evidence dependencies, including quoted text. Unknown/unresolved audiences are rejected,
  exact confirmed grants reach runtime actors, and modified handoff grants are rejected.
- The final Ornith Q4_K_M run passed with 12 requests and no repair attempts. It verified
  request-level secret isolation, actor packet knowledge, accepted disclosure, task reuse,
  grant escalation rejection and actual run-state reopening. Two pure access-policy tests,
  typecheck, lint and backend/web build passed. No mock functional/browser run was presented
  as Ornith evidence. See [qualification details](./world-access-qualification.md).
- W02 remains partial: Planner event audiences and uncited/misattributed private paraphrases
  in upstream confirmed prose still need their own policy owners. Public/private separation
  adds one generation and one validation call per participant; it is not a speed optimization.

### Task 55: qualify and complete shared retained-memory processing on Ornith

- Re-read AGENTS.md and System-Adv.md and inspected the current Task 54 worktree.
  W01 shared extraction already existed; actual-model comparison was the missing gate.
  Local LM Studio had Ornith-1.5-35B-A3B Q4_K_M loaded, so no model substitution was made.
- Added a bounded explicit live runner and a tiny synthetic Korean fixture. Its loopback
  proxy counts real forwarded requests; saved user settings remain untouched. The initial
  run failed the cost gate (24 individual versus 25 shared requests) and exposed completed
  actions retained as active records. The failed result was preserved.
- Shared closure work now groups only identical current evidence and known record sets,
  including source identity. Program-owned aliases map validated closures to each reader's
  local IDs; different private knowledge is never unioned. Prompts distinguish continuing
  obligations from fulfilled/incidental actions and copy closure evidence from current text.
- Final live validation passed with 24 versus 9 public-case requests, including retries,
  and 27.81 versus 8.25 seconds. Deadline preservation, explicit fulfillment, no-op replay,
  private isolation and later public disclosure passed. The full runner made 38 requests,
  including five additional privacy/disclosure requests. Author work and compression were
  excluded equally; the result is not a general throughput or full-world quality claim.
- Six pure grouping/parser/reducer tests, typecheck, lint and backend/web build passed.
  Functional model verification used Ornith; the prior mock browser/full suite was not
  rerun or relabeled as actual-model evidence. See [qualification details](./memory-qualification.md).

### Task 54: author reviewable source-fact audiences in ScenarioBuilder

- Re-read AGENTS.md and System-Adv.md before implementation. After the shared evidence,
  participant and information-rule stages, a bounded source-access task assigns every
  accepted claim to all participants, named participants, or unresolved access. Program
  code copies exact claim wording/citations and supplies stable fact IDs; the model only
  selects audiences. Malformed, missing, duplicate and foreign assignments retry locally.
- The scenario artifact and review UI now show each source fact and its initial audience.
  Unresolved access blocks confirmation. A source-access consistency check targets only
  the affected audience, situation or facet for repair; exact restricted-claim copies in
  public situation/facet text are blocked even if the check model misses them. Semantic
  paraphrases still require stronger enforcement and target-model review.
- Tests cover strict stored references, targeted repair, confirmation blocking, retained
  source revision and the responsive browser review. The required `sourceFacts` contract
  intentionally rejects older stored scenario drafts lacking the field; regenerate those
  drafts before confirmation. World StoryBuilder and actors do not yet consume grants.
- Verification: 456 Bun tests passed (one opt-in Office integration skipped), typecheck,
  lint and backend/web build passed, and all 31 browser tests passed in 52.3 seconds.
  No real Ornith inference or target-device qualification was run.

### Task 53: enforce explicitly scoped injected events in actor inputs

- Re-read AGENTS.md and System-Adv.md before implementation. Added an optional
  `visibleToActorIds` event entitlement, distinct from `participantIds` used in
  participant analysis. Missing entitlement keeps the existing public-event behavior.
  Explicit empty, duplicate or foreign audiences fail before the event is emitted.
- The event policy filters actor-visible history, every actor prompt, compression input,
  pre-round cues and fallback interaction text. Authoritative event/report artifacts retain
  the original details. Accepted private then public speech grants recipients the disclosed
  content at each accepted boundary; no event output cache crosses worlds.
- A failing visibility fixture preceded the change. Tests cover all actor prompt builders,
  compression, scoped disclosure, invalid audiences, world isolation and run-state reopen.
  Planner still produces public events, so confirmed rules do not yet author explicit
  audiences; source-fact access and free-text references remain W02 work.
- Verification: 449 Bun tests passed (one opt-in Office integration skipped), typecheck,
  lint and backend/web build passed, and three smoke browser tests passed. No real Ornith
  inference or target-device qualification was run.

### Task 52: preserve the actor's initial private concern in later decision context

- Re-read AGENTS.md and System-Adv.md before implementation. The prepared world already
  stored each participant's private concern in `ActorState.privateGoal`, but actor decision
  projection used only the replaceable prose summary. The thought request now receives
  the owner's bounded private concern directly through its per-turn context. Peer
  projections still exclude that field.
- A failing actor-packet test preceded the change. Prepared-world and storage tests verify
  the concern survives an omitted summary, remains actor-specific and reopens with run
  state. The actor graph still carries only trace and decision channels.
- Verification: 443 Bun tests passed (one opt-in Office integration skipped), typecheck,
  lint and backend/web build passed, and seven focused browser tests passed. Source-fact
  and event entitlement enforcement, accepted disclosure and real Ornith qualification
  remain W02 work; this task does not mark W02 complete.

### Task 51: share accepted interaction extraction across permitted readers

- Re-read AGENTS.md and System-Adv.md before implementation. Added an interaction identity
  to actor-visible entries so identical accepted content can be grouped without parsing
  reader-specific entry IDs or sharing outputs across worlds.
- One bounded model call extracts additions for each shared recipient group. Each reader
  with active records gets separate bounded closure work against only that reader's ledger.
  The author still processes its distinct intent/expectation context separately. Groups
  commit after earlier entries in every participating reader's accepted history.
- A controlled five-interaction/four-reader fixture requires five shared extraction
  calls instead of 20. The five-actor coordinator case counts five shared calls, five
  author calls and five compressions. Tests cover private audience isolation, different
  reader offsets, quote distribution, scoped closures, retries, replay and fast-mode
  scheduling. The deterministic model supports the new prompt purposes.
- Final deterministic verification: 442 Bun tests passed (one opt-in Office integration
  skipped), typecheck, lint and backend/web build passed, and all 31 browser tests passed.
  LM Studio listed Ornith Q4_K_M with no loaded instance. No before/after live comparison,
  model-quality finding or speed claim was made.

### Task 1: bounded model invocation and multimodal input boundary

- Re-read AGENTS.md and System-Adv.md before implementation.
- Added per-call output ceilings without mutating shared role settings.
- Added a bounded stream collector, total deadline, and caller/provider cancellation.
- Limited combined visible/reasoning output memory and rejected late canceled deltas.
- Applied a 512-token ceiling to action-catalog entries and reject truncated entries
  before acceptance; retry only the affected entry using the existing recovery loop.
- Added text/image input through the existing provider boundary and an inline-region
  encoder with a bounded byte size.
- Verified behavior through deterministic stream tests and a local HTTP provider.
- All graph, upload, world, and expanded report requirements remain open unless listed
  in a later completed task.

### Task 2: document ingestion, portable evidence, and converter boundary

- Re-read the governing rules and document-processing requirements before implementation.
- Added upload/status/extract/cancel/evidence API operations and document persistence.
- Native TXT/MD extraction preserves every decoded source character, line range, and
  character range while producing blocks no larger than 1,800 characters.
- Added Docling JSON translation with source element/page/table references, explicit
  pending visual regions, bounded output artifacts, a deadline, and cancellation.
- Added a pinned external Docling tool setup command; LibreOffice remains an operator
  dependency. No document parsing packages were added to the browser bundle.
- Verified concurrent uploads, cross-set identity checks, malformed encoding, byte limits,
  source offsets, failed-converter isolation, and API evidence retrieval.
- Actual synthetic Korean DOCX, PPTX, XLSX, CSV, DOC, and PDF conversions succeeded locally.
  DOCX cold invocation took about 50 seconds; subsequent invocations took about 9–12
  seconds. PDF conversion took about 39 seconds. Together with native TXT/MD tests,
  these cover basic eight-format smoke paths, not full visual/cell fidelity or general
  throughput guarantees.
- Remaining ingestion work includes visual-region persistence/VLM interpretation,
  page/slide/cell fidelity beyond the initial adapter, archive/process resource hardening,
  persistent converter reuse or measured admission limits, retry revision ownership,
  retained-file removal, and the full acceptance corpus.

### Task 3: shared ScenarioBuilder graph and backend execution path

- Re-read AGENTS.md and System-Adv.md before implementation.
- Added normalized optional context/preset/cast input and shared scenario contracts.
- Added a compact LangGraph for evidence, facets, situation, participants, rules, and
  checks. Graph state contains IDs and accepted references rather than source bodies.
- Added independent document reduction, three-child synthesis, and bounded model calls.
- Preserved supplied identities/traits in code and generated missing traits only.
- Reused accepted tasks by input/prompt/model fingerprint, repaired malformed outputs
  within three attempts, and added one semantic repair pass for affected tasks.
- Added durable task artifacts, creation/status/retry/cancel/confirm API, source revision
  checks, and scoped SSE with bounded snapshots and slow-reader disconnection.
- Remaining: topic buckets/full claim retrieval, original-evidence entailment checks,
  provider-wide admission, calibrated input token limits, cross-process leases, immutable
  sources, durable shared-call metric accounting, review UI, and downstream lock handoff.
- Actual target-model quality and target-environment throughput remain unverified.

### Task 4: document workflow UI and scoped field previews

- Re-read both governing documents and applied existing shadcn, minimal UI, and React
  performance guidance against DESIGN.md.
- Added a lazy home entry for multi-file source selection, reading status/retry, optional
  purpose/preset/participants, generation, read-only review, and confirmation.
- Kept the existing text-only creation/upload paths available.
- Shared wire schemas now serve backend storage and browser response parsing; domain
  normalization and reference/language checks remain in core.
- Persisted document/build IDs for reopening and retained the pending idempotency key
  before sending a generation request.
- Added selected-task subscriptions, retry replacement, duplicate/gap handling, bounded
  frame batches, visibility cleanup, and localized task/document/participant scope labels.
- Moved partial JSON interpretation to the server and reused the existing parser there.
  Measured document-dialog chunk size fell from 356.80 kB to 114.45 kB (gzip 96.58 to
  32.78 kB) during this task. This is a bundle measurement, not an FPS claim.
- Added a two-extraction runtime capacity limit and prompt cancellation of queued files.
- Verified actual native uploads through the API with a deterministic server model,
  locked cast preservation, confirmation/reopening, failure retry, scoped live previews,
  and the 390px dialog bounds. Inspected desktop, mobile, and live-preview screenshots.
- Remaining UI/product work includes retained-upload removal, source excerpt navigation,
  world handoff and selection, and the new report generation/completed-board experience.

### Task 5: independent world StoryBuilder and simulation handoff

- Re-read both governing documents before examining the run, Planner, and Generator paths.
- Reproduced a collision: 50 simultaneous same-name run creations originally produced
  one ID. Added UUID identities, atomic run-directory creation, fixed world-run
  idempotency, portable path validation, and manifest owner checks.
- Moved the now-shared bounded generation executor/validators to core/generation and
  progress transport to runtime/generation. Reused accepted-task persistence operations.
- Added a compact world StoryBuilder graph for opening, per-person starting state,
  agenda, information flow, and consistency checks. Fast mode enables ready independent
  branches; ordinary mode retains their sequential order.
- Preserved confirmed identities/personality/authority/goals in deterministic handoff.
  Generator initializes those profiles without regenerating their roster or cards.
- Initial private concerns remain outside public scenario text and other actors' initial
  prompt context; Planner/Coordinator receive a public fixed-constraint projection.
- Added world creation/status/preview/retry/cancel/run API, isolated persisted tasks,
  world preparation metrics, and idempotent run materialization after interrupted linking.
- Fixed duplicate run-start ownership before I/O and prevented overwriting completed or
  history-bearing runs through another start request.
- Connected confirmed review to story concretization and simulation launch in the UI;
  kept world API/schema code lazy-loaded and split the report-ready dialog out of App.
- Browser evidence covers real native uploads, deterministic scenario/world generation,
  simulation completion, preserved CTO/Finance profiles, source linkage, and preparation
  metrics. This does not establish actual sLM quality or calibrated source visibility.
- Remaining: compact legacy simulation/actor graphs, persistent mid-run recovery,
  structured source information access, provider-wide admission, shared preparation
  accounting, Multiverse supervision/UI, and the expanded report.

### Task 6: shared model admission and execution cancellation

- Re-read AGENTS.md and System-Adv.md; verified task 5's final 242-test result and build.
- Added one composition-owned admission queue per endpoint/model resource pool with
  configurable capacity, owner rotation, bounded queue/wait time, cancellation, and
  idle-pool cleanup. No new package dependency was added.
- Bound runtime-owned admission/signals through a narrow asynchronous execution scope;
  graph checkpoints do not gain controllers or scheduler objects. Production builder,
  simulation, memory, exact-choice, and report paths share the central invocation gate.
- Added independent admission wait metrics and waiting-state labels in both locales for
  scenario/world preparation. Persisted world metrics accept the new optional field.
- Disabled hidden SDK retries; task-level transport backoff is still outstanding.
- Removed automatic run cancellation after the final SSE reader disconnects. Explicit
  cancellation now aborts queued and live provider calls, while teardown clears descendants.
- Split text StoryBuilder HTTP streaming into its own controller and bound its lifetime
  to request/response cancellation. Document/world jobs remain independent of subscriptions.
- Controlled HTTP evidence: 50 independent LangGraph calls entered before releasing any
  response at allowance 50; nested mixed-role calls never exceeded allowance 2; canceling
  one scope preserved the sibling; provider failure released capacity without SDK retries.
- Runtime evidence: run stream closure preserved active execution; explicit cancellation
  persisted one canceled event and no failed event, with all admission permits released.
- This is not full Multiverse acceptance. Batch contracts/supervision, durable run resume,
  global usage budgets, shared preparation accounting, target-server measurements, and
  the expanded report remain incomplete.

### Task 7: Multiverse execution and selected-world controls

- Re-read both governing documents and the existing world preparation, run persistence,
  continuation, and frontend launch ownership before editing.
- Added shared batch schemas with a visible 1–50 world range, execution time budget,
  stable world identities, per-world status, and server-owned continuation fields.
- Added atomic batch/world creation and serialized batch updates. Batch ownership is
  recorded on world/run artifacts and guarded against ordinary start/mutation routes.
- Added independent world supervision, targeted preparation retry, scoped cancellation,
  deadline stops, and partial-outcome joins. Model settings are resolved once per active
  batch execution. Persisted configuration revision and distributed leases remain open.
- Added server countdowns: five seconds for the first three automatic approvals, then
  immediate progression. Disabling automatic progression resets/cancels the countdown;
  manual approval applies only to the exact selected waiting round.
- Deferred per-world long commentary, and released persisted run timeline caches at
  execution teardown. Shared/cross-world usage and analytical reports remain open work.
- Connected the Multiverse toggle, count/budget controls, summary counts, selected-world
  preparation streaming, cancellation, manual/automatic controls, and result navigation.
  Only selected detail is mounted; batch summaries do not include sibling histories.
- Added immediate optimistic switch feedback with rollback on request failure. Scoped
  the document dialog's transition to opacity so viewport changes do not animate width.
- Backend tests execute 1, 5, and 50 complete deterministic worlds, preserve cast and
  source ownership, reject duplicate/foreign commands, retain siblings after failure or
  cancellation, and demonstrate scoped manual progression and deadline termination.
- Browser testing covers actual upload/shared confirmation, two independent waiting
  worlds, one-world approval, automatic completion after page reload, resumed batch
  selection, result navigation, and 390px bounds. Desktop/mobile artifacts were inspected.
- Mid-round recovery, structured source visibility, source-linked VLM processing, shared
  usage accounting, target-model evaluation, and single-page/cross-world analysis are
  still required. This slice does not satisfy full System-Adv.md acceptance.

### Task 8: evidence-based analytical backend and reusable generation protocol

- Re-read the governing documents before the analytical work; re-inspected the working
  tree and verified outstanding checks when resuming it.
- Added compact analytical graphs for common perspective, SWOT findings/checks/scores,
  actor interpretation, material/scenario assessment, trajectories, and final synthesis.
- Preserved source locators and observation references through bounded evidence trees.
  Long recorded speech is partitioned rather than silently clipped. Reference membership
  and retained observation IDs do not establish full factual or semantic coverage.
- Independent branches can write their detail before unrelated world summaries finish.
  Invalid branches retry locally, keep valid siblings, and re-evaluate affected synthesis.
- Added program-owned trajectory IDs and distinct-world aggregation, unknown SWOT values,
  explicit incomplete-world coverage, and unavailable-input records.
- Added runtime/store/API ownership for report generation, accepted artifacts, scoped
  references, live previews, model-call metrics, cancellation, and call/deadline limits.
- Generalized shared generation event/preview ownership beyond ScenarioBuilder. Complete
  prompts and repair prompts are bounded; final detail uses a separate prose instruction.
  A slow active draft survives terminal-status eviction; broken readers cannot block cleanup.
- Verified actual configured deterministic Observer invocation for Korean reports and a
  native document → shared scenario → three worlds → source-linked analytical report path.
  These tests use the explicit test provider and make no claims about target-model quality.
- Remaining: single-page report UI, full source retrieval/entailment quality, report export,
  aggregate usage, durable ownership/restart handling, and target-model validation.

### Task 9: persisted report discovery and freshness

- Re-read AGENTS.md and the expanded System-Adv.md, inspected storage/runtime/API owners,
  and added focused failing tests before implementation.
- Added run/batch subject lookup returning the latest saved report without resolving
  provider settings or invoking a model. A shared response schema owns its wire contract.
- Added an atomic subject pointer with same-process serialized publication. Concurrent
  creation and replayed older requests preserve creation order; reports remain canonical
  in their own directories. Repeated creation can repair interrupted index publication.
- Distinguished current, outdated, and unavailable source snapshots while preserving
  the saved report. Verified restart lookup, subject isolation, invalid identifiers,
  changed terminal-source revisions, and missing sources with no model-settings reads.
- Cross-process fencing and full immutable source-history versions remain unimplemented.
  The new report UI is still pending; this is its persisted discovery contract.

### Task 10: single-page analytical report and shared generation presentation

- Re-read AGENTS.md and System-Adv.md; applied shadcn, minimal UI, and React guidance under
  DESIGN.md. Kept the existing Radix primitives and added no package dependencies.
- Replaced top-level report tabs with permanent metrics, explicit analytical generation,
  a live stage/task/output surface, accepted conclusions, SWOT/trajectory/assessment cards,
  and read-only detail dialogs. Batch-owned runs can select their parent batch analysis.
- Kept relationship heatmap/network/replay and round/message inspection through deferred
  record dialogs. Removed the unused frontend legacy commentary generation call; stored
  commentary remains inspectable. Legacy automatic commentary finalization remains pending
  consolidation, as does the new analytical export path.
- Generalized the browser generation hook/reducer and accepted-task adapter so builders
  and reports share bounded, validated subscriptions. A failing test reproduced lost active
  task state after many sibling completions; terminal-first eviction now preserves it.
- Mounted at most three live task outputs, with scoped text subscriptions, attempt replacement,
  independent follow scrolling, hidden-page cleanup, and provisional-text labeling.
- Added deterministic SWOT geometry; unknown/failed values never become zero or a filled
  polygon. Accepted score tasks can reveal the radar before the full report completes.
  Loading/entry effects use opacity/transform and honor reduced-motion/visibility.
- Added scoped evidence inspection, explicit world/run locators, accessible focus restoration,
  viewport-bounded desktop/mobile dialogs, and both English/Korean messages.
- Reproduced loss of accepted partial prose when retrying. Runtime now retains the prior
  body during a retry and after provider failure; accepted assembly replaces it on success.
- Metrics combine selected-run and analytical calls with an explicit scope label. Total
  shared preparation/Multiverse accounting remains incomplete; no total-batch claim is made.
- Verified actual deterministic run → new analytical generation → accepted report in the
  browser, plus fixture-based evidence/unknown-axis/live-retry tests. Inspected desktop,
  mobile, live, detail, and radar screenshots. Real-model quality remains unverified.
- Measured Report chunk 36.37 → 29.53 kB after deferring record renderers. The common chunk
  grew 440.78 → 469.89 kB (gzip 137.46 → 146.55 kB). These are bundle observations, not a
  claim of overall FPS or latency improvement. Full total-cost optimization remains open.

### Task 11: portable analytical export

- Re-read AGENTS.md and System-Adv.md and inspected analysis storage, runtime, HTTP,
  report composition, and existing run download ownership before editing.
- Added a versioned analytical JSON export with subject/source identity, accepted content
  digest, current source freshness, complete accepted sections, rubric values, coverage,
  only the referenced source excerpts/locators, and recorded report-generation metrics.
  Exporting a missing accepted result or cited excerpt fails explicitly.
- Kept the result available when its current source changes or cannot be loaded. Reads
  do not resolve model settings, schedule generation, or alter accepted artifacts.
- Added report JSON/Markdown entries alongside existing run downloads. Markdown derives
  from the same validated JSON snapshot, uses the existing English/Korean labels, orders
  the conclusion first, and escapes untrusted document/model text before writing it.
- API and browser tests cover partial sections, unknown scores, cited page locations,
  unknown provider usage, stale/missing sources, malformed reference membership, and
  actual downloads without model calls. Shared and batch-wide cost aggregation remains
  separate work; export metrics are explicitly analysis-generation scoped.

### Task 12: preserve ActorRail following after final-round height measurement

- Re-read both governing documents after the interrupted export turn and checked the
  current worktree and live process state before continuing validation.
- Full E2E initially passed 26/27; the existing ActorRail end-follow assertion remained
  230 pixels above the bottom after the final round. This exposed a real mismatch between
  an estimated appended row and its final measured height under concurrent browser load.
- Kept the virtual list in its existing owner. Explicit upward reader movement pauses
  following; merely growing content does not. A following viewport re-aligns after both
  appended-row commits and content-size changes. Archive mode stays start-anchored.
- Focused ActorRail browser tests passed 3/3. After the correction, all 27 full E2E tests
  passed, including the export downloads, scroll behavior, Multiverse, and report workflow.
- No FPS improvement is claimed; this is an ordering and scroll correctness fix.

### Task 13: page-scoped PDF vision and settings-controlled concurrency

- Re-read `AGENTS.md` and `System-Adv.md` and inspected the document conversion, evidence,
  model invocation, admission, settings, and browser upload owners before changing code.
- Docling 2.129.0 now exports referenced PDF page images. Each PDF page pairs its
  rendered image with extracted page text in one bounded VLM call through the existing
  `storyBuilder` provider configuration and shared endpoint/model admission pool.
  Exact Docling text/table blocks remain separate from semantic visual blocks; scanned
  pages can succeed without selectable text. Failed pages remain explicit coverage gaps.
- Standard mode serializes document extraction and PDF page calls. Fast Mode enables
  independent work up to the persisted `settings.concurrency` value (1–50). The LLM
  settings screen exposes the allowance, and changes update admission without restart.
  PDF vision results merge in page order even when model calls finish out of order.
- Verified Docling's actual referenced image paths with a one-page PDF and exercised
  the full upload-to-evidence path using the deterministic test model. Focused tests
  cover image/text pairing, ordering, capacity, missing images, long-text disclosure,
  settings bounds, and admission updates. `bun test` passed 291 tests, type checking,
  lint, and build passed, and the 27-test browser suite passed. After adding the
  labeled setting-field check, its focused three-test browser suite and the affected
  server/PDF tests passed again.
- Visual Office conversion, source mapping back to native slide/sheet locations,
  deployment qualification on VDI, target VLM evaluation, and visual metrics persistence
  remain open; this slice does not claim full eight-format visual coverage.

### Task 14: small-input converter comparison and original XLSX formula evidence

- Re-read the governing rules and specification. Created nine small synthetic inputs in
  `sample-input-items/` and compared Docling JSON with LibreOffice-only flat ODF
  conversion across all eight requested extensions plus an image-only PDF.
- The comparison in `docs/document-converter-comparison.md` found that Docling read
  the scanned PDF but flattened one selectable-PDF table value incorrectly (`Costs 0`
  versus source `Costs 80`). LibreOffice retained the selectable value but could not
  read the scanned page without OCR/VLM. Both paths had different structural losses.
- Added bounded direct OOXML formula extraction for XLSX. Original formulas and stored
  values now become cell-linked evidence; a missing cached result remains unknown.
  Docling worksheet groups now provide sheet names and one-based table row locators.
  This avoids treating LibreOffice's recalculated uncached value as source evidence.
- Exercised the real PDF path with local LM Studio `ornith-1.5-35b-a3b` using only the
  19 KiB image-only PDF. One page completed with correct May 12 and 120 million KRW
  facts. This is a smoke result, not general model quality or throughput evidence.
- The original 5 KiB XLSX passed through the real document runtime and Docling locally:
  two sheet-linked table blocks and two original cell-linked formula blocks were saved.
  Full `bun test` passed 297 tests; typecheck, lint, and build passed. The first
  28-test browser run had two navigation/reload failures; both tests passed in a
  focused run, and the unchanged full 28-test suite passed on rerun.
- Added exactly pinned, server-only `fflate` and `fast-xml-parser` dependencies after
  checking maintenance, MIT licenses, and the requested 2,000-star threshold. The
  production audit had existing findings elsewhere; neither new package appeared.
- Remaining: a larger format and conflict corpus, PDF table discrepancy repair,
  complete slide/sheet visual mapping, VDI deployment qualification, and persisted
  VLM/converter usage accounting.

### Task 15: independently cross-check PDF numbers before source confirmation

- Re-read `AGENTS.md` and `System-Adv.md`, then reproduced the selectable-PDF table
  discrepancy with the local Ornith model. At a 512-token role budget the visual
  response was incomplete; at 1,600 tokens it identified `Costs 80` in the image
  and reported Docling's `Costs 0` as conflicting text. This is a bounded local
  observation, not a universal model guarantee.
- Added a bounded LibreOffice Draw flat-XML page-text adapter. When `soffice` is
  available, differing numeric sets from Docling and LibreOffice retain both
  page-linked readings and the VLM output. The conflict adds a failed coverage
  region, stores `partial` with a machine-readable issue, and blocks dependent
  scenario confirmation. Image-only PDFs with no independent text do not receive
  a fabricated numeric conflict.
- The document form now distinguishes numeric conflicts from unread regions in
  English and Korean. The current check detects numeric-set disagreement only;
  identical numbers with different labels and nonnumeric conflicts remain open.
- Small local integration runs confirmed `overview.pdf` becomes partial and
  `scanned-note.pdf` remains ready. The local Ornith run with independent text
  again favored the image-supported `80` while preserving the unresolved issue.
- Full verification passed 303 Bun tests across 90 files, typecheck, lint, build,
  and 29 Playwright browser workflows, including the localized partial-conflict
  presentation. This verifies the new boundary and regression behavior, not
  general PDF conflict detection or model accuracy.

### Task 16: extracted-text precedence and TypeScript PDF replacement

- Replaced the active Docling process and Python setup with pinned PDF.js and N-API
  Canvas dependencies. PDF.js extracts selectable text and renders the same page;
  the VLM receives both in one call, including image-only pages with empty text.
- DOCX, DOC, PPTX, and XLSX now use bounded LibreOffice-to-PDF conversion before
  the common page pipeline. CSV, TXT, and MD use native text decoding.
- Selectable PDF text is authoritative over conflicting visual numbers. Original
  XLSX cell values and cached formula results are read directly from OOXML and
  take precedence over LibreOffice's recalculated PDF representation.
- At this checkpoint, the old `docling` and `libreoffice` evidence method labels
  remained only for reading already persisted artifacts. No active extraction
  called either method. Task 20 removes the `docling` label from that contract.
- Local small-file adapter checks covered a selectable PDF, an image-only PDF,
  and DOCX/DOC/PPTX/XLSX conversion. Target VDI binary support and a larger
  document corpus still require validation.
- Actual local `ornith-1.5-35b-a3b` calls retained `Costs 80` for selectable
  `overview.pdf`, read the image-only decision and budget, and withheld an XLSX
  visual claim with a number absent from the original workbook cells.
- Full verification passed 298 Bun tests across 87 files, typecheck, lint,
  backend/web build, and 28 browser tests. The first full browser pass had two
  navigation/state timing failures; both passed in isolation and all 28 passed
  on the unchanged full rerun.

### Task 17: structured CSV evidence after converter removal

- Re-read `AGENTS.md` and `System-Adv.md`; identified that the native CSV path
  preserved characters but lost columns and source row locations after Docling
  was removed.
- Added pinned, server-side Papa Parse `5.7.0` with its exact type package. The
  bounded parser accepts quoted delimiters/newlines, preserves Korean cell text,
  rejects ambiguous headers and malformed column counts, and emits table evidence
  with header names and original record indices.
- All records contribute to missing-value and numeric range statistics. Detailed
  evidence retains the first and last 40 rows; a sampling issue states the scope
  when middle rows are omitted. The original upload remains in document storage.
- Focused parser and API tests cover quoting, missing values, malformed inputs,
  row locators, and upload-to-evidence persistence. A local 100,000-record,
  1.58 MiB synthetic parse took about 69 ms and retained 81 blocks; this is one
  local sample, not a target-VDI latency or memory guarantee.
- Full verification passed 302 Bun tests across 88 files, typecheck, lint, and
  backend/web build. Browser behavior was unchanged; CSV's HTTP persistence path
  was exercised by the document controller test.

### Task 18: recorded resource accounting across shared scenario and worlds

- Re-read the governing documents and inspected scenario, world, run, report, export,
  and UI metric ownership before editing. Shared ScenarioBuilder model-call metrics
  now persist beside its accepted tasks; retries that return metrics remain separate
  recorded calls and survive reopening.
- Added read-only accounting from the existing owners. A world's run log already
  contains its preparation calls, so the projection uses that log once; it reads
  preparation metrics directly only when no run exists. A bounded line reader
  selects model metrics without materializing a run's full interaction history.
- Analysis JSON export version 2 and `GET /api/analysis/:id/accounting` distinguish
  shared preparation, per-world work, analysis generation, and the recorded overall
  total. Markdown includes the same scopes. Unknown provider usage or missing
  artifacts produce `null`/`—`, not fabricated zero usage.
- Controlled multi-world tests verify that shared calls are counted once, and
  export tests verify unknown token usage and read-only behavior. Provider requests
  that fail before returning metrics are not yet counted; transport-attempt ledgers
  and target-server measurements remain open.
- Added a compact terminal-report card with shared, all-world, final, overall, and
  scroll-bounded per-world values. Its query is enabled only after analysis reaches
  a terminal accepted state, avoiding repeated scans of 50 run histories during
  generation. English/Korean labels and the selected UI locale drive the display.
- Browser checks cover a saved single-world report and 50 scroll-bounded world rows
  at 390px, including unknown usage without horizontal overflow.
- Full verification passed 306 Bun tests across 91 files, typecheck, lint, and
  backend/web build. Before the display change, a 28-test browser run had three
  navigation/readiness timing failures; those cases passed in isolation and the
  unchanged 28-test suite passed on rerun. After the display change, all 29 browser
  tests passed, including the new batch accounting and 390px layout check. The
  strengthened 50-row scroll assertion passed in its focused browser rerun.

### Task 19: admitted model failures in scoped resource accounting

- The LLM invocation boundary now records an admitted request that fails or is
  canceled before it returns metrics. Scenario, world-preparation, and report jobs
  append these facts to their existing bounded model-call logs; simulation and
  commentary append them to the run event log. A request canceled while waiting
  for admission does not become an admitted model call.
- New artifacts carry an accounting-version marker. The read-only projection counts
  observed failed attempts once within their owner scope, including world
  preparation already handed to a run. Their token and duration totals remain
  unknown; legacy artifacts without failure coverage also remain unknown rather
  than appearing complete. No provider request is made by the accounting endpoint.
- An actual 503 provider test verifies one persisted failure without invented
  metrics. A multi-world integration test adds failures to shared preparation,
  world preparation, one run, and report generation and verifies each scope and
  the overall total. The recorded comparison now distinguishes the retired
  LibreOffice flat-text experiment from the active PDF.js text-plus-page-image
  VLM path. PDF text-library candidates were checked without adding a dependency.
- Full Bun tests, typecheck, lint, backend/web build, and all 29 Playwright tests
  passed. Bounded transport backoff, document VLM call accounting, and target-model
  qualification remain open.

### Task 20: retire the Docling evidence method

- Removed `docling` from the shared evidence-method type and the document and
  analytical-reference parsers. A single method list now owns those three
  contracts. No extractor or provider dependency is introduced.
- Old persisted evidence or report references using that retired method no longer
  pass current parsing. Re-upload original files and regenerate dependent scenario
  and report artifacts rather than relabeling an old extraction as a new method.
- Contract tests failed before the removal and now verify that current `pdfjs`
  evidence and references remain accepted while `docling` is rejected. Full
  verification passed 310 Bun tests across 93 files, typecheck, lint,
  backend/web build, and all 29 Playwright tests.

### Task 21: bounded structured-task transport recovery

- ScenarioBuilder, per-world StoryBuilder, and analytical report tasks now count
  transient provider failures and content repairs within the same maximum of
  three attempts. Existing provider SDK retries remain disabled, and each failed
  admitted request retains its own unknown-usage record.
- The LLM adapter classifies retryable 408, 429, 500, 502, 503, 504, and selected connection/timeouts,
  stops on credentials or exhausted quota, honors valid Retry-After hints up to
  30 seconds, and otherwise uses bounded exponential jitter. The retry delay runs
  after invocation releases its admission permit and is canceled with the job.
- Deterministic task tests cover mixed transport/content attempts, exhaustion,
  immediate configuration failure, and cancellation during backoff. A controlled
  HTTP test verifies that a real 503 releases admission while waiting, then
  re-enters for a successful second request. A persistent 503 produces exactly
  three recorded failures rather than hidden extra requests.
- Full verification passed 318 Bun tests across 95 files, typecheck, lint,
  backend/web build, and all 29 Playwright tests.
- This policy is scoped to structured generation tasks. Simulation-role retries
  and per-call document VLM accounting remain separate work.

### Task 22: page-scoped VLM model-call accounting

- New document artifacts persist bounded page-numbered model-call metrics and
  admitted failures beside the original file. PDF.js interpretation passes the
  matching page identity to the existing LLM boundary; image-only pages are
  accounted for in the same way as selectable-text pages. Missing provider usage
  remains unavailable, and a failed metrics write fails extraction rather than
  silently accepting an undercounted document.
- Read-only analytical accounting combines document VLM calls with shared
  ScenarioBuilder calls once for a confirmed source revision. World rows remain
  independent of that shared cost. Missing old document logs or a changed
  document-set revision make the shared total unknown, not zero.
- Document persistence tests cover concurrent page records and reopening. Actual
  local-model and controlled 503 tests cover successful and failed PDF calls; the
  multi-world analysis test verifies one shared contribution and missing-log
  behavior. UI and exported Markdown label the scope as shared source and
  scenario preparation.
- Full verification passed 322 Bun tests across 95 files, typecheck, lint,
  backend/web build, and all 29 Playwright tests.

### Task 23: document ingestion scope clarified

- DOCX, DOC, and PPTX need only converted-PDF page text paired with the image of
  that same page. The VLM returns a semantic description, not complete OCR.
- Removed the extra DOCX paragraph and PPTX shape/coordinate extraction and their
  locator contracts. Existing page text remains authoritative over visual claims.
- XLSX original cell values and formulas remain a separate source-fidelity rule;
  CSV, TXT, and MD retain their bounded native text paths.
- The local LibreOffice integration processed the small DOCX, DOC, and PPTX fixtures
  through actual PDF conversion; each produced page text, separate visual evidence,
  and a recorded model call. Full verification passed 322 Bun tests, typecheck,
  lint, build, and 29 browser tests.

### Task 24: cited-number checks in scenario evidence

- A source claim now checks its numerical tokens against the exact evidence blocks
  it cites. Parent digests check new numbers against accepted child claims rather
  than borrowing a value from an unrelated block or sibling.
- The same pure number rule serves PDF visual evidence and ScenarioBuilder. It
  accepts common comma and zero-padded date renderings, recognizes values beside
  Korean units, and preserves sign and percent distinctions.
- Unsupported numbers trigger the existing bounded task retry, leaving accepted
  sibling tasks reusable. This guards quantitative fidelity; it does not prove
  full semantic entailment of a cited sentence.
- Verification: 328 Bun tests passed (one opt-in Office integration skipped),
  typecheck, lint, and backend/web build passed. No browser code changed.

### Task 25: original-evidence checks for final scenario claims

- The check stage now reloads each final claim's exact cited evidence blocks and
  asks one bounded model task per claim to compare meaning, negation, approval
  status, time, units, and qualifications. Blocks include method and locator so
  the model can distinguish parsed text from a VLM interpretation.
- Claims cite at most four blocks each, keeping every source check within the
  generation input budget. The program assigns source-check issue scope and makes
  every reported source contradiction blocking, even if a small model mislabels it.
- A blocking source check targets the final digest for one repair pass; accepted
  lower branches remain reusable. Missing cited excerpts fail rather than silently
  approving the scenario. Persistent contradictions leave the draft blocked.
- Model judgments can still miss unsupported meaning; target-model evaluation and
  visible source excerpts remain open.
- Focused local LM Studio checks used one synthetic Korean claim and its cited
  excerpt. Ornith `ornith-1.5-35b-a3b` and Gemma `google/gemma-4-12b-qat` both
  flagged the reversed approval status and returned no issue for an exact supported
  claim. Gemma returned no final text at a 384-token ceiling; 640 tokens yielded
  complete JSON. The separate `ternary-bonsai-2-27b` model failed to load, so no
  quality conclusion was drawn for that model.
- A full serial ScenarioBuilder run with the same local Ornith model and one tiny
  Korean source reached rules but failed `rule-variation` after three attempts:
  its array exceeded the four-entry schema limit repeatedly. The run spent 26
  model attempts over about 238 seconds and accepted 14 tasks before failing.
  This is an observed remaining small-model contract failure, not a completed
  end-to-end qualification.
- Verification: 332 Bun tests passed (one opt-in Office integration skipped),
  typecheck, lint, and backend/web build passed. A standard-mode concurrency test
  caught and fixed parallel check calls when Fast Mode was off.

### Task 26: single-rule output and local reasoning diagnosis

- An actual serial ScenarioBuilder run on the synthetic Korean budget source with
  local Ornith reached rule generation but failed `rule-variation`: three outputs
  exceeded the four-entry array schema. The graph retained 14 accepted tasks and
  stopped after 26 total model attempts in about 238 seconds.
- Each shared rule task now requests one `entry` string and deterministically
  stores the existing one-element `entries` artifact. An overlong array retries
  only that rule; a normalized saved task is reusable without another model call.
- An isolated `rule-variation` request returned a valid single entry on its first
  Ornith attempt. A full rerun no longer showed an oversized rule array, but
  `rule-termination` exhausted three output-length attempts. It stopped with 13
  accepted tasks after 21 attempts in about 208 seconds. End-to-end local-model
  qualification is therefore still incomplete.
- Gemma 4 12B returned no final text before the 640- and 1,024-token limits on
  the current OpenAI-compatible route. In local probing, adding `reasoning: off`
  to that route did not suppress the reasoning output. The same small synthetic
  rule call through LM Studio's [native chat endpoint](https://lmstudio.ai/docs/developer/rest/chat)
  with `reasoning: off` returned final content in about three seconds with 89
  output tokens. The native endpoint is not yet wired into Simula's streaming,
  admission, cancellation, and metrics contracts; do not treat this probe as a
  completed application feature.
- Verification: 333 Bun tests passed (one opt-in Office conversion test skipped),
  typecheck, lint, backend/web build, and all 29 browser tests passed after the
  deterministic test-model response was updated to the new `entry` contract.

### Task 27: LM Studio compact-task reasoning control and final issue capacity

- Reused the installed LM Studio OpenAI-compatible adapter. Local requests showed
  `reasoning_effort: none` produces final text on Gemma 4 12B and Ornith under a
  384-token cap, while `low` on Gemma spent the cap in reasoning. Compact
  `storyBuilder` tasks now send `none` only when no explicit user reasoning setting
  or `extraBody.reasoning_effort` exists. Detailed tasks and observer calls retain
  their configured path. The task fingerprint includes the changed policy.
- A controlled HTTP test verifies wire settings, deltas, and preservation of
  explicit role values. A real local Gemma call streamed a final response with
  provider token usage and zero reasoning tokens.
- A full serial Gemma ScenarioBuilder run on one tiny Korean source reached final
  assembly but exposed a shared-schema bug: the per-check six-issue limit still
  constrained the assembled specification. The shared schema now independently
  limits each check to six and the final specification to one hundred issues.
- A full Fast Mode Gemma rerun completed as a reviewable `blocked` specification
  with ten visible issues, 42 model calls, five local content retries, and about
  209 seconds elapsed. No reasoning-only truncation occurred. These synthetic
  runs establish the execution path, not general model accuracy or release quality;
  some issue judgments still need source/user-constraint review.
- Verification: 335 Bun tests passed (one opt-in Office conversion test skipped),
  typecheck, lint, and backend/web build passed. The prior task's 29 browser tests
  were not rerun for this backend-only change.

### Task 28: participant provenance in scenario checks

- The rule-check frontier now receives accepted participant IDs, names, authority,
  and program-owned name/personality lock flags. Participant and rule instructions
  distinguish user constraints and generated scenario assumptions from document
  claims; absence of either cast type from a document is not itself an issue.
- A focused boundary test reproduced the prior missing-source false blocker for
  a user-supplied CTO role and verifies the corrected check packet. A local Gemma
  4 12B probe on the synthetic case returned no issue after the explicit omission
  instruction; this is one sample, not a measured false-positive rate.
- Verification: 336 Bun tests passed (one opt-in Office conversion test skipped),
  typecheck, lint, backend/web build, and the three document-scenario browser
  tests passed.

### Task 29: revision-scoped source inspection in the scenario review

- The completed review now lists cited evidence and loads only the selected block.
  Its list and detail have independent bounded scrolling and stack on narrow screens.
  Exact content, locator, and extraction method are shown together; VLM page
  interpretation is explicitly labeled as content interpretation, not full OCR.
- The exact-ID document endpoint requires the scenario's document-set revision and
  confines the block to its owning document. A changed set returns 409. This stops
  current extraction from masquerading as a past scenario's evidence, but does not
  provide immutable historical source snapshots.
- Focused API tests cover exact lookup, foreign-document rejection, missing revision,
  and changed-source rejection. Browser tests cover lazy loading, selected detail,
  mobile overflow, and a changed-source error. Desktop screenshot inspection confirmed
  the source content is readable inside the review dialog.
- Verification: 337 Bun tests passed (one opt-in Office conversion test skipped),
  typecheck, lint, backend/web build, all 30 browser tests, and diff whitespace check
  passed.

### Task 30: real small-model core path and source-to-simulation report repair

- Re-read the governing files and traced the upload → shared ScenarioBuilder →
  per-world StoryBuilder → actor simulation → analytical report path. An isolated
  local LM Studio run used the one-page synthetic `sample-input-items/overview.pdf`,
  Gemma 4 12B, one admitted call at a time, and explicit no-reasoning role settings.
  Its PDF extraction retained selectable text and separate semantic page-image
  interpretation, including the May 12 decision and 120/80/40 million KRW figures.
- The first shared scenario was falsely blocked because a model treated an exactly
  balanced projected budget as proof that no decision tension could exist. The fact
  checker now distinguishes arithmetic contradiction from uncertainty and conditional
  trade-offs. Retry produced a reviewable and confirmable scenario while retaining a
  nonblocking source-coverage gap.
- A later world failed because its checker re-audited confirmed scenario assumptions
  against unsupplied original excerpts and did not receive the confirmed cast. The
  world checker now treats the confirmed specification as authority and receives the
  participant scope. Retry yielded a ready world with both specified traits and the
  same source figures.
- One real one-round simulation completed before the actor-field correction, but the
  model put `Thought / Intent / Message` into the thought and intent fields. Removed
  the three-field prompt example and added bounded retry for mixed role sections.
  A new one-round simulation completed with distinct CTO and Finance thoughts,
  intents, and speech around a hypothetical technical incident. This demonstrates
  one possible simulated development, not predictive accuracy.
- The first analytical run failed because the model repeatedly mistyped a long
  evidence ID. The shared executor now presents task-local short aliases and restores
  exact references before validation; unknown aliases still retry/fail. A later report
  reached all nine sections after empty model gap placeholders were removed, perspective
  evidence was included in conclusion scope, and unassigned trajectory proposals were
  excluded from observed distributions. The one simulated world remained explicitly
  unclassified. Accepted siblings were reused on scoped retries.
- World evidence now labels simulated events and interactions separately from source
  claims. The latest boundary change passes deterministic tests but has not yet been
  qualified through another complete real-model report. A separate conclusion probe
  still phrased a simulated incident like a real defect and overstated conditional
  financial feasibility; semantic report quality remains open.
- Verification after the shared prompt/alias contract update: 341 Bun tests passed,
  one opt-in Office conversion test skipped, typecheck, lint, backend/web build,
  and all 30 browser tests passed. The single real-model case proves this path can
  finish after scoped recovery, not a general success rate or target VDI readiness.

### Task 31: distinguish source facts from simulated developments in report conclusions

- The report conclusion now receives separate bounded source-material and simulated-
  world summaries alongside accepted section abstracts. A focused model check flags
  simulated incidents asserted as source facts, unsupported feasibility conclusions,
  and unobserved trajectories; one local conclusion repair is allowed. Persistent
  issues leave the conclusion failed while preserving accepted sections.
- The completed board shows a localized, subdued statement that simulated events and
  frequencies do not establish real-world outcomes or probabilities. No new browser
  state, request, or animation was added.
- A real Gemma 4 12B analysis of the synthetic PDF produced all nine sections and
  labeled the technical incident as simulated, but still inferred current liquidity
  insufficiency from projected revenue, costs, and a requested reserve. The final
  consistency check missed that inference. Citation membership alone is therefore
  insufficient evidence of sound financial interpretation.
- Material and scenario branches now check the summary and each finding separately
  against bounded source facts; scenario checks also receive simulated observations.
  Real local probes distinguished an unsupported funding-gap claim from a directly
  sourced reserve request. A material-branch run repaired the false shortage and
  explained missing cash timing and allocation data. Two scenario-branch probes had
  different results (one remained incomplete after local repair, one completed), so
  small-model acceptance reliability remains unqualified.
- A complete local Gemma 4 12B report retry on the synthetic PDF reached all nine
  sections after reusing accepted tasks. An earlier pass was partial because the
  opportunities branch emitted malformed JSON and the conclusion depended on it;
  scoped retry recovered both. The accepted material summary distinguishes projected
  revenue and costs from unknown liquidity and timing. However, some detailed prose
  still implies stronger financial feasibility than the source supports, and the
  simulated technical bug occasionally reads like an operational constraint. A
  complete report is therefore not yet evidence-quality acceptance.
- Final verification for this task: 345 Bun tests passed, one opt-in Office test
  skipped, typecheck, lint, backend/web build, and all 30 browser tests passed.
  Target VDI and a broader document/model corpus remain unqualified.

### Task 32: validate final prose and reject omission-driven SWOT feedback

- The local report graph now checks the material and scenario board summary plus each
  detail paragraph against bounded source claims and simulated observations. A failed
  check repairs only that detail; persistent issues leave only that section incomplete.
  The conclusion applies the same claim-sized check in addition to its cross-section
  check and allows two bounded rewrite opportunities with stronger second feedback.
- SWOT findings now receive claim-sized checks with the shared evaluation perspective.
  A real Gemma 4 12B run showed the former broad check demanding that an otherwise
  bounded opportunities finding assert funding sufficiency and cover unrelated event
  pressure. That omission-driven feedback repeatedly failed the branch. A focused
  regression test covers the failure and the branch no longer uses that broad check.
- The first real-model retry with paragraph checks caught simulated technical repairs
  written as real requirements and withheld the conclusion after one unsuccessful
  rewrite. It also exposed continuing SWOT classification problems: internal revenue
  and collaboration were labeled as an external opportunity. Focused checks are useful
  guards, not proof of semantic accuracy. A second local retry with stronger conclusion
  instructions and two rewrite opportunities recovered the opportunities branch but
  still ended partial at the conclusion: the 12B model repeatedly converted a simulated
  staging bug into a real repair obligation. The check correctly rejected that claim.
  The source/scenario/simulation provenance must reach each finding and synthesis input
  more explicitly; increasing retries alone is not a sufficient quality strategy.
- Current deterministic verification: 349 Bun tests passed, one opt-in Office test
  skipped; typecheck, lint, and backend/web build passed. Target VDI qualification and
  broader source/model evaluation remain open.

### Task 33: carry evidence provenance through accepted report findings

- Each newly accepted finding now derives its source/scenario/user/simulation/visual-
  interpretation categories from the stored evidence references. The model does not
  choose the categories. Missing referenced records fail the affected branch instead
  of producing an ungrounded label. Score and detail tasks receive the derived fields;
  final synthesis receives bounded finding text with provenance plus section summaries
  marked as analytical interpretation.
- The report detail UI and portable Markdown display existing localized category names
  beside each newly generated finding. Historical saved reports without the optional
  provenance field remain readable without assigning a false default category.
- Deterministic verification passed 350 Bun tests with one opt-in Office test skipped,
  typecheck, lint, backend/web build, and all 30 browser tests. A real Gemma 4 12B
  retry on the isolated synthetic PDF ended partial: the scenario detail was rejected
  for calling a requested reserve an unconfirmed surplus, and the conclusion was
  rejected for turning a simulated bug into a real repair obligation. Provenance
  reaches the report and synthesis input, but labels alone did not repair those
  semantic inferences. The next change needs smaller source/observation/uncertainty
  synthesis units rather than another whole-conclusion retry.

### Task 34: synthesize conclusions from independently validated scope units

- Moved conclusion generation out of the top-level report graph into a bounded synthesis
  use case. Source assessment receives only document evidence; simulated observations
  receive only world evidence and coverage/trajectory counts. They run independently in
  fast mode. Implications wait for both accepted units and receive their output plus
  bounded analytical section abstracts, provenance, and missing-section status.
- Each unit produces one paragraph and a short summary with at most 768 output tokens.
  A scoped support check allows one local rewrite; code assembles accepted units into
  the existing medium-length conclusion contract. Retry preserves successful units.
  Live UI labels identify material assessment, simulation observations, and implications;
  their checks stay in the synthesis stage.
- The first real 12B run generated a properly scoped source paragraph and simulated-event
  paragraph. Its implication explicitly denied a real repair obligation. The checker then
  rejected an uncertainty statement about unverified funding, treating it like an assertion
  of absent funding. Check instructions now distinguish those meanings. The same-report
  retry reached ready for all nine sections. The assembled conclusion explicitly separates
  projected source figures from available cash and describes the technical incident within
  the simulated world. Some wording still overstates theoretical financial viability, and
  the scenario section exposes a machine stop-reason token. This one recovered case does
  not establish broad semantic accuracy or target-model acceptance rates.
- Unit tests cover scope isolation, dependency order, local repair, and accepted-sibling
  reuse. The first full browser run passed 29/30; the remaining smoke test used an ambiguous
  substring selector matching both Relationships and People and relationships. It now
  selects the exact button, and the focused seven-test report/smoke run passed. Final
  verification passed 351 Bun tests (one opt-in Office skip), typecheck, lint, build,
  and all 30 browser tests. The split adds successful synthesis calls while limiting
  rework to a failed unit; no end-to-end latency improvement is claimed.

### Task 35: separate prompt ownership and context provenance

- Each generation purpose now owns a function-named file under the corresponding
  `prompts/` directory. Planner, actor/card generation, coordinator, observer, memory
  compression, repair, document interpretation, builders and report tasks use the same
  organization. Prompt-family indexes select existing steps; templates no longer share
  a monolithic `prompts.ts`. Invocation and validation remain with their workflow owners.
- The shared flat formatter escapes embedded markup. Callers classify original source,
  user input, hypothetical setup, simulated history, earlier model output, choices and
  review candidates explicitly. There is no nested XML and models do not generate input
  tags. Existing JSON/prose/finite-choice output contracts are preserved.
- Story revisions retain message order via original indices while separating user input
  from generated drafts. Source checks separate the cited excerpt from the candidate
  claim. Report generation and prose checks retain source/simulation scope; observer
  prompts distinguish recorded interactions from earlier analytical summaries.
- Focused tests caught obsolete plain-text layout expectations during migration and a
  real boundary escape in an actor-name interpolation. The actor identity now enters an
  escaped ACTOR block. Final verification passed 356 Bun tests with one opt-in Office
  integration skipped, typecheck, lint and backend/web build. The complete browser suite
  passed all 30 tests; after the last observer context split, all three smoke workflows
  passed again. Prompt modules satisfy the 350-line limit and required headers.
- No live model calls were made for this refactor. These checks establish formatting,
  scope, recovery and workflow contracts; small-model semantic accuracy, latency and
  target VDI behavior still require separate measured qualification.

### Task 36: retain immutable source revisions through generation and reporting

- Document storage now captures the selected set manifest, extraction evidence and
  recorded document-model calls before shared scenario generation. Publication uses an
  atomic directory rename under the existing per-set mutation lock. Evidence files are
  hard-linked because their owner replaces them by rename; append-only call records are
  copied. Captures are idempotent and partial publication is not exposed to readers.
- Builder evidence reduction, original-source checks, retries and confirmation use that
  captured revision even if newer documents or re-extractions arrive during generation.
  Unready sources and uncaptured obsolete revisions are rejected. Reading a retained
  excerpt never substitutes current evidence or generates a snapshot as a side effect.
- Report source resolution and document accounting now use the scenario's captured
  revision. New source revisions mark an existing world's report outdated while leaving
  its evidence available for generation, reading and export. Later document calls are
  excluded from the old report's source-processing scope; source snapshots survive
  process reopening and removal of the current call log.
- Tests cover re-extraction/reopening, frozen call records, concurrent idempotent capture,
  revision/document guards, in-flight source edits, confirmation, multi-world report
  scope, retained excerpts, and outdated report discovery/export. Legacy tests expecting
  every source change to block confirmation were updated to assert the retained-version
  contract. Verification: 360 Bun tests passed with one opt-in Office integration skipped;
  typecheck, lint, backend/web build and all 30 browser tests passed.
- This uses the existing single-process document writer. Durable cross-process ownership,
  retention/deletion policies, and target VDI filesystem qualification remain open. Past
  source revisions that were never captured cannot be reconstructed; previously accepted
  report content remains readable, but new generation requires an available source
  snapshot or a new scenario based on current materials. No real-model quality or
  end-to-end latency improvement is claimed for this storage change.

### Task 37: fence shared scenario generation across local processes

- Added durable per-build execution ownership using Bun's built-in SQLite. A claim has
  an owner token, increasing generation, expiry and cancellation flag. Scenario runtime
  renews every five seconds against a 30-second lease and checks ownership before model
  admission. No new package dependency was added.
- Scenario manifest changes and accepted task publication now require ownership. A short
  immediate database transaction holds the ownership check and atomic file rename together;
  temporary file preparation stays outside the transaction. Accepted task files remain the
  authoritative artifacts. Conditional release cannot unlock a successor, and displaced
  workers cannot overwrite either task content or terminal job state.
- Another runtime recognizes the job as running, avoids duplicate model work and can
  persist a cancellation request. A cancellation during initial manifest publication now
  records canceled status without invoking the model. Cancellation between a failure and
  its publication is also handled without accepting an incorrect terminal failure.
- Tests use separate Bun processes for exclusion and displaced-worker fencing, controlled
  lease clocks for expiry, two runtime instances for cancel/status behavior, and persisted
  generation artifacts for interrupted completion notification. Reopening under a new owner
  reuses an accepted unit with no second model call. Local tests also verify old release
  cannot clear a new claim and a late worker cannot replace a successor manifest.
- Verification passed 367 Bun tests with one opt-in Office test skipped, typecheck,
  backend/web build and all 30 browser tests. Lint identified a private helper name that
  matched React's hook naming convention; it was renamed without suppressing the rule,
  and lint passed. No real model or VDI deployment qualification was claimed.
- This closes the ownership gap only for shared ScenarioBuilder execution and confirmation.
  World preparation, simulation, analytical reports, document mutations, cross-process
  admission and live subscription routing remain separate coordination work. Recovery is
  an explicit retry after lease expiry; no automatic billable restart is introduced.

### Task 38: fence analytical report execution and accepted evidence

- Reused the existing durable lease for analytical report execution. Start claims the
  report before model work; competing runtimes read active ownership instead of treating
  the run as interrupted, and cannot admit a duplicate execution for that report ID.
  Cancellation can be requested through another runtime and preserves user/deadline/
  call-budget terminal reasons.
- AnalysisStore requires the active lease for report manifests, accepted tasks and cited
  evidence. A displaced worker cannot overwrite the successor's terminal state, citation
  body or generated unit. Rejected publication cleans its temporary file. Call/deadline
  policies stay in the analytical owner, and retries retain prior accepted report prose.
- Terminal failure publication now shares its proven cancellation-versus-ownership rule
  with ScenarioBuilder through runtime/generation. Cancellation racing with failure wins;
  loss of ownership cannot publish a terminal update over the current owner's state.
- Tests first reproduced false interrupted status and a displaced worker overwriting its
  successor. Added report runtime cancellation/duplicate/late-result tests and storage
  tests covering all three accepted artifact kinds. Existing export, discovery, budget,
  evidence isolation and partial-report recovery checks still pass.
- Final validation passed 371 Bun tests with one opt-in Office integration skipped,
  typecheck, lint, backend/web build and all 30 browser tests. No target-model or VDI
  throughput qualification is claimed.
- Durable ownership now covers shared scenario and analytical execution. World preparation,
  simulation, document mutation, model admission across processes, and live stream routing
  remain open. The latest-report subject index also still serializes only inside one
  process; the new per-report lease does not establish safe multi-server deployment.

### Task 39: fence world preparation and recoverable run handoff

- World preparation now uses the existing durable lease for model admission, accepted
  task writes and manifest publication. Another runtime sees active preparation instead
  of falsely reporting interruption, avoids duplicate calls and can request cancellation.
  Displaced workers cannot accept an opening or overwrite the successor's world state.
- Preparation and simulation handoff claim the same world ownership. A competing handoff
  returns a conflict while the first is active; a later retry returns the same deterministic
  run. Both the staged run directory and the world-to-run link are fenced at publication.
  The run directory is renamed under the short ownership transaction, closing the race
  between the earlier ownership check and completion of asynchronous file staging.
- A crash after run creation but before link publication is recovered by adopting that
  same run. Preparation usage is seeded once, and handoff makes no model calls. Canceling
  a delayed handoff prevents run publication while preserving its prepared story for a
  later explicit launch. The world-run identity mapping has one owner in runs/run-id.ts.
- Every production bounded-task repository now requires a lease at task publication; the
  old optional unguarded path in shared task persistence was removed. No new dependencies
  were introduced. The related-artifact callback is synchronous and serves the concrete
  world-to-run directory boundary, without holding a transaction across asynchronous work.
- Tests reproduced false interrupted state, late world-state overwrite and a displaced
  handoff creating an orphan run. Added ownership and handoff race/recovery/cancel tests.
  Full verification passed 378 Bun tests with one opt-in Office integration skipped and
  all 30 browser tests. After the final identity-rule extraction, 14 focused tests,
  typecheck, lint and backend/web build passed. Test-double return annotations were fixed
  after the initial type/build check; no broad suppression was added.
- Simulation rounds still use their existing process-local execution owner and cannot yet
  resume mid-round. Batch supervision, document mutation, admission and live routing across
  processes, and subject-index coordination remain separate work; this is not a claim of
  general multi-server deployment or target VDI qualification.

### Task 40: fence simulation writes and connect durable run cancellation

- Simulation and legacy commentary now claim the same durable run ownership boundary.
  Execution rereads the manifest after claiming, so stale controller input cannot restart
  history-bearing runs. RunStore requires a lease for manifests, state, Markdown, events
  and timeline writes. Atomic artifact preparation lives in runs/artifact-writer.ts;
  history append checks the owner inside its short storage transaction.
- Accepted events are persisted before broadcasting; provisional board previews check
  ownership without becoming accepted history. Cancellation/failure snapshots and usage
  diagnostics may be saved by the current canceled owner, but displaced owners cannot
  append or publish over a successor. Test fixtures now seed storage through real leases.
- Runtime ownership bridges local cancellation to a token-scoped persisted request, and
  remote cancellation to model abort signals and manual round waiters. Listener/timer/cache
  cleanup stays with the owning lifecycle. Cleanup from an old worker cannot cancel a
  successor. The model integration checks a supplied ownership contract before queueing
  and again after admission, releasing capacity without a provider request if ownership
  changed while waiting.
- An additional startup race was reproduced: cancellation during settings I/O was erased
  by continuation reset immediately before dispatch. Reset now occurs before awaiting I/O,
  preserving that request and producing canceled status without starting the simulation.
  Legacy commentary's pending state is written only by its runtime owner; API diagnostics
  retain the run ID without logging unrestricted persistence exceptions.
- Tests cover stale event/state/report/manifest publication, duplicate start/commentary,
  remote cancellation of an actual round wait, successor protection, live provider abort,
  queued ownership loss without a provider call, and early startup cancellation. Final full
  verification passed 384 Bun tests (one opt-in Office skip) and all 30 browser tests, plus
  typecheck/lint/build. The final controller simplification also passed three focused tests
  and static/build checks. No model quality, deployment or latency improvement is claimed.
- These fences do not make event/timeline/state/manifest publication a single crash-atomic
  transaction. Mid-round replay/recovery, durable round approvals, batch supervision,
  cross-process model admission, document mutation, subject indexing and live event routing
  remain open, along with target VDI qualification. Existing history is not silently rerun.

### Task 41: persist standalone round approvals under execution ownership

- Replaced the unbounded in-memory future-approval set with one canonical gate per run
  in its execution database. Only the opened round of an active, uncanceled generation
  accepts approval. Duplicate consumed requests are acknowledged without advancing a
  later round; canceled, expired and predecessor approvals cannot be consumed.
- Coordinator completion events identify whether continuation is required. Standalone
  execution opens the gate before publishing that event and preserves early approval
  when registering the wait. Final rounds open no gate. API approval no longer relies
  on the receiving process's local active-run set. Batch-specific controls remain separate.
- Runtime owns cancellation, local wakeup and a 250 ms poll only during a pending wait.
  Completion, cancellation, disposal and ownership loss release the timer/listener.
  The shared execution-database module owns connection lifetime and busy timeout;
  existing publication fences continue to use the same transaction boundary.
- Focused tests reproduce early approval during event publication, wrong-round requests,
  duplicate consumption, cancellation, scope mismatch and lease replacement. An actual
  independent Bun process approves a waiting run without an in-process notification.
  Full Bun verification passed 389 tests with one opt-in Office skip; typecheck, lint
  and backend/frontend build passed. Initial browser regression passed 29/30; the
  frontend-only automatic-streak fixture timed out waiting for its fifth mocked approval.
  Without code changes, its focused four-test file and the complete 30-test browser suite
  then passed. The initial timeout remains unexplained; no assertion or timeout was weakened.
- This preserves accepted control input; it does not recover a process interrupted after
  approval consumption or provide mid-round checkpoints. Durable batch supervision,
  cross-process admission, document mutation, subject indexing and live event routing,
  and target-model/VDI qualification remain open.

### Task 42: resume accepted run events across disconnects and local processes

- Replaced whole-history-then-subscribe delivery with a bounded append-only JSONL reader.
  Run-scoped byte cursors identify complete record boundaries, preserve UTF-8 offsets and
  reject malformed, cross-run, out-of-range and mid-record resume positions. Incomplete
  trailing writes remain pending; invalid committed records and oversized records fail.
- Local publication only wakes the reader; accepted delivery always comes from the same
  log. Registration before replay and continued sequential reading remove the history/
  subscribe race. Other-process appends are checked at EOF every 500 ms. A slow reader
  backpressures log reads instead of accumulating all history in a publisher queue.
  Connections have idle heartbeats and dispose file handles, timers and listeners on
  disconnect. Terminal runs drain their history before a stream-end notification.
- Browser subscriptions keep native Last-Event-ID reconnection, reject duplicates, detect
  cursor gaps, resume from the accepted offset, and bound frame-batched pending events.
  Hidden tabs detach and reconnect on visibility; closed terminal streams stay closed.
  Stored-history failures stop repeated retries and display an English/Korean message
  without canceling execution. The shared check validates transport envelopes; complete
  schema validation for legacy event payloads remains outstanding.
- Tests cover replay-time appends, cursor resume and scope, partial UTF-8 records, corrupt
  and oversized records, backpressure, abort while opening, terminal drain and resource
  cleanup. A separate Bun writer proves delivery without a local publisher. The browser
  test uses a real short-lived HTTP response and verifies the next request's Last-Event-ID
  plus successful round continuation. Earlier route-fulfilled mocks did not produce the
  cursor-bearing reconnect; they were replaced by this actual network fixture.
- Full verification passed 399 Bun tests (one opt-in Office skip), typecheck/lint/build,
  and 31 browser tests. The final lightweight envelope implementation also passed focused
  contract tests and the real browser reconnect check. Its first Zod version pulled the
  initial JS chunk to 563.34 kB; equivalent native envelope checks restored it to 475.69 kB
  (148.33 kB gzip), compared with 474.06 kB before this task. This is a bundle measurement,
  not a claim about end-to-end VDI performance.
- This closes accepted run-event routing across local processes sharing storage. It does
  not provide provisional generation/board stream routing, compact snapshot hydration,
  mid-round recovery, durable batch supervision, cross-process model admission, document
  mutation or subject-index coordination. Target-model and VDI qualification remain open.

### Task 43: fence Multiverse supervision and propagate parent cancellation

- Batch start claims durable execution ownership before settings/model work; competing
  supervisors do not dispatch a second set of worlds. Read-only status recognizes an
  active peer instead of declaring its work interrupted. BatchStore requires a scoped
  lease and performs bounded manifest read/reduce/replacement inside the execution
  database's write reservation. Independent store instances retain all 50 sibling updates.
- Batch identity, source version, request and ordered world count/IDs remain immutable.
  Displaced supervisors cannot publish over successors or unlock them. Ordinary updates
  reject canceled owners; terminal cleanup explicitly opts in under the still-current
  lease. Existing completed world results remain available during cancellation or failure.
- World preparation and simulation accept a narrow parent execution contract (abort signal
  and active-ownership check). Parent cancellation/loss propagates to model admission,
  active work and manual waits; accepted preparation results recheck parent ownership.
  Child artifact leases still own their writes. This is not a distributed atomic commit
  across batch, world and run databases.
- Another runtime may persist a full-batch cancellation, observed on the five-second
  ownership renewal. Local user cancellation/deadlines abort descendants immediately.
  Deadline callbacks do not replace an already-observed cancellation. World-specific
  mode/continue/cancel commands still require the active supervisor; remote commands are
  rejected instead of pretending to stop work by overwriting a live manifest.
- Tests cover duplicate supervisors, peer status, remote cancellation during preparation
  and actual manual simulation waits, late completion after takeover, wrong-scope writes,
  canceled-owner restrictions and concurrent sibling updates. Existing 1/5/50-world,
  selective retry, scoped cancellation and deadline cases pass. Full regression passed
  404 Bun tests (one opt-in Office skip) and 31 browser tests. After the final cancellation
  boundary restriction, all six focused ownership/storage tests, typecheck, lint, build
  and the Multiverse browser workflow passed again.
- Durable per-world command routing/countdown recovery, compact mid-round checkpoints,
  cross-process admission, document mutation, subject indexing and provisional stream
  routing remain incomplete. Target VDI/model qualification is still required.

### Task 44: deliver per-world controls through a bounded durable inbox

- Added generation-scoped ordered world commands in the existing execution database.
  Acceptance checks world membership, active uncanceled ownership, and the exact waiting
  round under the same write reservation used for batch progress. Receipts deduplicate
  the latest manual approval and world cancellation. Old-generation commands never run
  in a replacement execution; expired/canceled owners cannot acknowledge pending work.
- The inbox retains at most 150 progress commands and one reserved cancellation per world
  (200 total). Full progress queues reject additional mode/approval requests while leaving
  room to stop a world. Auto-mode transitions retain their order, and reapplying an
  unchanged mode does not reset an active countdown. Command types have one shared owner
  consumed by backend storage and browser API/hook contracts.
- The active supervisor serially applies commands and acknowledges them after the effect.
  Local requests wake it; another process's requests arrive through a 250 ms poll. Current
  mode is reread synchronously when constructing the round owner, avoiding a stale mode
  from an earlier asynchronous manifest read. Already-advanced approvals do not advance a
  subsequent round. Consumer timers/listeners stop with the batch. Storage failure produces
  interrupted supervision rather than silently dropping commands or claiming a user stop.
- World mode/approval HTTP responses now return 202 accepted; existing status reads show
  applied state. Actual model work and final world artifacts remain under their existing
  owners. Individual cancellation leaves other world workflows running.
- Tests prove remote true/false mode ordering, exact/duplicate approvals, scope isolation,
  generation replacement, queue bounds with reserved cancellation capacity, and consumer
  storage failure. A separate Bun process cancels one preparing world while its sibling
  completes. Existing 1/5/50-world and countdown policies remain passing. Full regression
  passed 408 Bun tests (one opt-in Office skip) and 31 browser tests; after final API/type
  adjustments, focused control/storage/countdown tests, typecheck/lint/build and Multiverse
  E2E passed. The added storage-failure case also passed with final typecheck/lint.
- This persists accepted requests while their batch execution is active. It intentionally
  does not replay old pending controls after a generation change or recover a round whose
  effect committed before a process crash. Restartable round/countdown checkpoints,
  cross-process model admission, document mutation, subject indexing and provisional
  generation streams, plus target VDI/model qualification, remain open.

### Task 45: separate actor decision channels from per-turn context and runtime settings

- ActorAnnotation now contains only trace and decision. The coordinator constructs a
  per-turn context projection and passes provider settings separately when building the
  graph. Node factories bind those dependencies; LangGraph value streams contain neither
  settings nor full scenario/actor objects. Public actor module exports reflect this
  boundary without retaining the previous full-state construction API.
- The projection reuses existing actorPromptContext/contextUsedByActor behavior. It keeps
  the deciding actor's consumed profile/action fields and public peer profile/label fields,
  omitting raw histories, peer private goals/memory, relationships, unrelated coordinator
  trace fields and original scenario bodies. Action records and control values are copied
  for that turn. Original accepted histories remain in the owning simulation state.
  This does not claim a new structured obligations ledger or full token-budget enforcement.
- A focused test exposed an existing sequential-round defect: the latest roster was passed
  with an actor object from the original round input. The actor now resolves by ID from
  the actual current snapshot. Later sequential actors see visible prior speech; fast-mode
  actors still share the initial snapshot, and decision commits retain roster order.
- Controlled projection measurement with one actor, 10,000 visible entries and a repeated
  source body: the previous channel shape serialized to 4,476,172 bytes; the projected
  execution context is 3,010 bytes and initial graph channels are 158 bytes. An earlier
  two-actor fixture measured 6,523,537 bytes and is not the same comparison baseline.
  These are serialized input sizes, not measured total heap, latency or model quality.
- Tests verify private-peer/source exclusion, visible-history and action preservation,
  isolation from later input mutation, actual graph value streams without provider secrets,
  parallel graph separation and causal sequential/shared-snapshot semantics. Existing
  thought/intent/speech repair and exact-choice contracts pass. Final verification passed
  413 Bun tests (one opt-in Office skip), all 31 browser tests, typecheck, lint and build.
- Full workflow/role/card state compaction, durable artifact-reference checkpoints,
  structured visibility/obligations, cross-process admission and the remaining deployment
  and model qualification requirements remain open. This is not mid-round resume support.

### Task 46: compact actor-card graph state and require complete generated attributes

- Per-card graph channels now contain only partial card output and retry counts. The
  original scenario, provider settings, full roster and event callback no longer enter
  ActorCardAnnotation. Generator supplies only consumed context fields; graph construction
  snapshots the roster and keeps settings/emission in external execution dependencies.
  Role/background/personality/preference still execute sequentially within each card,
  while independent cards retain their existing fast-mode behavior.
- Card completion rejects missing or blank fields instead of substituting invented
  background/personality/preference values. The assigned roster name remains authoritative.
  Existing field response bounds and five-attempt policy are unchanged. Removed the unused
  exported card-step list and the obsolete full-state initializer contract.
- Tests verify incomplete-card rejection, assigned-name preservation, actual compact graph
  value streams, per-card provider/emitter isolation, roster snapshot isolation, dependency
  order, and a fresh preview stream replacing an empty failed role attempt. Existing prompt
  contracts pass after their fixtures adopt the new context/state boundary. Verification
  passed 415 Bun tests (one opt-in Office skip), typecheck, lint and build. Initial browser
  regression passed 30/31; the known automatic-streak fifth-approval timeout recurred.
  Three traced focused repetitions and a traced full 31-test run then passed without a
  product-code change. Temporary failure-only diagnostics were removed; assertions/timeouts
  were not weakened. The intermittent round-control failure remains unresolved.
- Parent workflow/role state compaction, durable graph checkpoints, the structured memory/
  visibility work, model input/output budget qualification and target deployment checks
  remain required. This does not claim card checkpoint recovery or measured latency gains.

### Task 47: retain round control state outside the bounded display history

- Reproduced deterministic loss of a completed round after 350 log events and replayed
  history, and loss of terminal state after display-window eviction. The run store now
  reduces lifecycle events into a separate constant-sized, run-scoped projection.
  Older round/start events cannot rewind progress; foreign-run events are ignored.
  Final rounds explicitly marked `awaitsContinuation: false` no longer request approval.
- Store/reducer tests cover eviction, replay, terminal retention and scope changes. The
  automatic-streak browser test also injects a stale snapshot and 350 log events without
  weakening its assertions. Recorded verification passed 420 Bun tests (one opt-in Office
  skip), typecheck, lint, build, four focused round browser tests and all 31 browser tests.
- The original intermittent fifth-approval timeout was not reproduced during eight
  diagnostic repetitions. Temporary diagnostics were removed. The deterministic defects
  above are fixed; evidence does not prove they caused that original intermittent failure.

### Task 48: complete prompt ownership and prevent private motive leakage into peer memory

- Actor response-repair instructions now live in separate functional prompt files:
  `retry-section.ts` and `retry-message.ts`. Detection and retry execution remain with
  the actor node; correction data still uses the escaped `FEEDBACK` block. AGENTS.md
  records the single-purpose file and flat-context-block requirements. Seventeen focused
  prompt/actor tests, typecheck and lint passed for this refactor.
- Found and reproduced a visibility defect: every accepted interaction appended the
  author's intent and expectation to recipients' and public observers' memories. This
  metadata entered both later actor decisions and memory-compression requests.
  Memory projection now appends internal metadata only for the author; other eligible
  actors receive visible content alone. Original interaction records remain unchanged
  for analysis, and private/group/solitary audience rules are preserved.
- Before the fix, five focused assertions failed on leaked private text. After the fix,
  19 focused tests passed, including actual sequential/parallel actor prompt capture and
  compression input capture. Full verification passed 425 Bun tests with one opt-in
  Office integration skipped, typecheck, lint and backend/web build. All eight focused
  document, Multiverse and simulation smoke browser workflows passed (23.8 seconds).
- This change applies to newly projected interactions; existing stored summaries are
  not rewritten. Structured obligations, explicit initial source-access enforcement,
  durable graph checkpoints and measured target-model qualification remain open.

### Task 49: retain source-linked actor obligations independently of lossy summaries

- Added a per-actor ledger for commitments, decisions, authority changes, constraints
  and unresolved matters, with exact source quotes, speaker identity and a processed
  history cursor. New actor-visible entries are classified one bounded unit at a time.
  Schema/reference/quote checks reject invented evidence and foreign closures. Unmentioned
  records remain active; closures retain later evidence. Identical wording from different
  speakers remains distinct. Free-text compression cannot erase these records.
- Active records enter actor context separately from recent-history truncation. Processing
  skips accepted entries and includes the final round. Invalid content has three attempts;
  records are never silently evicted at capacity. Fast mode now controls both compression
  and retention concurrency. This introduces additional model work, documented with its
  current input/output/record bounds; no latency improvement or model-quality claim is made.
- Extended the existing run-owned state callback to coordinator boundaries before/after
  retained-memory updates. The existing fenced state file preserves committed interaction
  history if retention fails, and stores completed ledgers for later inspection. This is
  not a second checkpoint system and does not enable automatic mid-round resume.
- Tests cover exact-source validation, explicit closures, omitted-record preservation,
  cursor reuse/mismatch, capacity without eviction, speaker distinction, summary loss after
  30 entries, final-round retention, canonical storage reopen, bounded repair, and serial/
  parallel memory calls. Target-model extraction/closure semantics, long-run archive/retrieval,
  compact parent graph state and durable graph resume remain required.
- Final verification: 435 Bun tests passed (one opt-in Office integration skipped),
  typecheck, lint and backend/web build passed, and all 31 browser tests passed in
  53.7 seconds. No real provider calls or semantic-quality measurements were made.

### Task 50: reconcile the advancement documentation

- Replaced the outdated planning-baseline table with an active checklist separating
  completed implementation scopes, missing changes and unverified acceptance gates.
- Preserved detailed contracts in system-adv-specification.md and retained earlier
  results here as historical evidence. Neither the interrupted graph-settings refactor
  nor the proposed shared memory extraction is marked implemented.
- Fixed local real-model qualification on Ornith-1.5-35B-A3B; Gemma is comparison-only
  upon explicit user request. Added T0–T8 test sequencing, small-case fixtures and required
  result metadata. This is a documentation-only revision, with no new model run.
- Verified 84 local links/anchors, preserved all 22 original requirement rows, and
  checked the 14 completed scopes, 12 remaining work items and nine validation stages.
  `git diff --check` passed; application tests were not rerun for this documentation edit.

## Current status ownership

The old phase table duplicated and lagged the implementation. Use
[completed scopes](../System-Adv.md#required-user-features),
[remaining work](../System-Adv.md#3-work-order), and
[validation stages](../System-Adv.md#4-verification-and-poc-completion) in the active plan.

## Environment evidence and open decisions

- Local LibreOffice and the current macOS N-API canvas binary were exercised. Earlier
  Docling/uv installation evidence belongs to the retired comparison path.
- Target VDI installation/service permissions have been requested but are not confirmed.
- Do not infer target-model quality or target-server capacity from local deterministic tests.

## Historical verification notes through Task 12

- `bun test`: task 12 result is 283 passed across 84 files.
- `bun run typecheck`: passed.
- `bun run lint`: passed.
- `bun run build`: passed; largest browser JavaScript chunk remains below 500 kB.
- Tasks 1–2 browser regression: first run had one automatic-continuation timeout;
  isolated rerun and the subsequent full 20-test run passed.
- Task 3 browser regression: all 20 existing E2E tests passed. The new backend workflow
  is covered by focused graph/API tests; its browser workflow awaits the new UI.
- Task 4 focused browser workflow: 3 passed. Initial full run: 22 passed, one existing
  ActorRail follow-scroll assertion failed. Its isolated rerun passed, followed by a
  complete 23-test passing regression run. Final typecheck, lint, and build also passed.
- Task 5 focused browser workflow: all three document tests passed, including the new
  confirmed scenario → world StoryBuilder → completed simulation path. Full regression
  passed all 23 tests. Portable manifest validation was corrected before the final unit run.
- Task 6: final typecheck, lint, and build passed. The first full browser run passed
  21/23 tests; two existing landing dialog-opening checks failed. Both isolated checks
  passed, then the unchanged full regression passed 23/23. The initial UI failure cause
  remains unconfirmed; no timeout increase or weakened assertion was used.
- Task 7: 266 unit tests, typecheck, lint, and build passed. The new Multiverse browser
  workflow passed after fixing immediate switch feedback and verifying responsive dialog
  bounds. Full browser regression passed all 24 tests. Largest browser JS chunk was
  440.78 kB (gzip 137.47 kB); this records bundle size, not an FPS improvement.
- Task 8 completion check: 275 unit tests across 78 files and all 24 existing browser
  tests passed. Typecheck, lint, and build passed. Browser regression verifies existing
  workflows, not the still-unimplemented new report board.
- Task 9: two new discovery/storage tests failed before implementation and passed after
  it. Full unit verification passed 277 tests across 80 files; typecheck, lint, and build
  passed. No UI rendering code changed in this task.

- Task 10: initial full unit run had two obsolete tab-contract failures; those tests now
  verify the required single-page/deferred-inspection behavior. Final unit run passed
  281 tests across 82 files. Typecheck, lint, and build passed. The focused browser run
  passed 7 tests and the full regression passed 27, including three new analytical UI
  tests. Post-capture wording corrections preserve the provisional/accepted distinction.
  After those wording corrections, typecheck/lint/build and all three analytical browser
  tests passed again; the final live screenshot was inspected for draft labeling.
- Task 11/12: 283 unit tests across 84 files, typecheck, lint, and build passed. The
  first full 27-test browser run had the final-round ActorRail failure described above.
  Its focused 3-test run and the subsequent unchanged full 27-test suite passed after
  the scroll correction. New report JSON and Markdown downloads were exercised through
  actual browser file saves, and read-only API tests confirmed no model invocation.
