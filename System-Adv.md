# Simula — Feature-Complete PoC Plan

Updated: 2026-09-24. Status: **feature-complete PoC validated on small inputs with local Ornith; broader model quality and 50-world load remain follow-up work**.

## 1. Goal and scope

Demonstrate this user journey with small real inputs and local Ornith:

**Upload materials → generate and confirm a scenario → develop the situation → run actor interactions → read the analysis.**

This is a functional PoC, not production hardening. This file replaces the previous
W01–W12 implementation backlog and release gates. Read it and [AGENTS.md](./AGENTS.md)
before each task. Work in complete, useful modules, without expanding into unrelated cleanup.

### Required user features

“Implemented” below means the code path exists, not that the complete Ornith journey
has passed. Update status and remaining work in this table as each feature is verified.

| Feature | Required PoC behavior | Current implementation | Remaining implementation / verification |
| --- | --- | --- | --- |
| Upload | Accept PDF, DOCX, DOC, PPTX, XLSX, CSV, TXT and MD; optional context and meeting/presentation preset. | Upload and optional-input UI/API implemented. All eight small formats passed the opt-in extraction test; the live browser journey omitted context and participant traits successfully. A separate Ornith API run omitted all participants, selected the meeting preset, and reached a reviewable scenario and ready world with four generated participants. The browser regression also submits `participants: []` with the meeting preset and shows two generated roles. | No further input-path work is required for the small PoC; assess role realism during source-quality review. |
| Read materials | LibreOffice conversion; matching PDF page image plus extracted text for VLM interpretation. Preserve key content and original spreadsheet values; extracted text takes precedence. A page interpretation is a bounded content summary stored for later stages, not model-authored document JSON. No Docling, full OCR or shape/coordinate extraction. | All eight small formats passed extraction. Fresh Ornith checks accepted `overview.pdf` with separate extracted text and visual interpretation and `scanned-note.pdf` with visual interpretation only. Earlier Ornith checks also covered DOCX and XLSX native cell evidence. | Review additional document layouts only if the small-input PoC exposes a specific failure; general fidelity work is deferred. |
| Stepwise generation contract | ScenarioBuilder, per-world StoryBuilder, per-turn actor and analytical LangGraph generation stages keep only the current unit's needed context and accepted fields or durable task references. The existing top-level simulation graph carries bounded authoritative run state, but model prompts receive scoped projections rather than that whole state. A node requests one decision (`1/0`), one index from supplied choices, a bounded selection of supplied indices, or one coherent short-to-medium text field. Code parses selections, slices the supplied lists, attaches IDs and source references, and assembles the stage's JSON from accepted state; the model never needs to author a stage-sized JSON object. Stream partial text to the UI as a preview, but commit it only when the response is nonempty, ends normally and is not truncated. Accept a choice only when it belongs to the supplied set. Advance when every required field is accepted; retry only the incomplete unit within a small limit without discarding accepted siblings. Parse untrusted input and enforce source membership, visibility and privacy boundaries. Do not run an extra model review or reject otherwise complete prose for subjective style, wording or language. | The common generation executor now accepts only text or finite choices; ScenarioBuilder, StoryBuilder and analytical branches assemble their stored artifacts in code. Legacy commentary and actor retained memory also use field-local prose/choices instead of model-authored JSON. | A fresh Ornith browser journey passed both single-world and two-world paths after these field conversions. Incomplete-field recovery has focused tests; inspect memory recovery on another observed live failure only if one occurs. |
| Model output budget | Do not use provider Structured Output APIs, JSON response mode, or `withStructuredOutput` for generation. Ask for plain text or finite choices and assemble JSON in application code. Give each call enough completion headroom: shared generation and exact-choice paths allow 2,048 output tokens by default, with role settings free to allow more; the prompt, not a tiny token ceiling, guides the desired short or medium answer. Keep a normal-finish requirement and reject genuinely truncated responses. | No provider Structured Output API is used. Shared generation and exact-choice requests now allow 2,048 tokens; direct role calls use configured role limits, and the isolated Ornith test configuration allows 4,096. The prior world-summary truncation completed on the first local Ornith retry at 2,048 tokens, preserving full text and eight observation references; the subsequent full browser journey reached ready analysis. | The updated workflows passed a fresh local Ornith browser journey. A lower user-selected role limit remains an explicit user choice. |
| ScenarioBuilder | Build one shared, material-grounded scenario in this dependency order: extract bounded source claims and summaries; select each claim's audience by participant index; write premise, purpose, decision and setting as separate text fields; choose an omitted cast size from 2–6; generate each missing name or role title, personality, authority and goal in its own unit while preserving user-entered fields; then add assumptions and rules as separate fields. Choose a bounded evidence frontier from supplied source indices and let code attach citations. Retain accepted text, selections and source IDs in graph state. A claim is complete when its text finished normally and its selected references exist; the scenario becomes reviewable only when all required fields are present and code has assembled its JSON. Confirmation locks the reviewed scenario before world creation. | Generation, review, confirmation and locked participant fields implemented. Source claims, overviews and gaps now use bounded text tasks; code assigns citations and chooses a bounded reduction frontier through indices. The new evidence route reached a reviewable scenario and complete live Ornith journey on `notes.txt`. Source audiences use finite choices assembled in code and passed [live Ornith](./docs/source-access-choices-qualification.md); situation, participant fields, facets and rules are separate text tasks, while the omitted-cast count is a finite choice followed by name tasks. A no-entered-cast Ornith run initially repeated CFO in later name slots; after the name boundary and prompt were corrected, retry produced four distinct roles, a reviewable scenario and a ready world. | Broader document layouts and generated-name realism remain quality follow-ups; the demonstrated small-input path is complete. Targeted slot reuse is covered by the same-prompt unit test. |
| StoryBuilder | After scenario confirmation, generate each world's public opening setting, immediate situation and any needed assumption as separate short-to-medium fields. For each confirmed participant, add public position, private concern, agenda and known information in bounded units; use supplied actor or source indices when a selection suffices. Keep private fields out of other actors' prompts and public output. Retain accepted fields and allowed references in the world graph state; code assembles the world artifact only after its required fields finish normally. If Multiverse is selected, create independent world states at this point while retaining the single confirmed scenario. | Public setting, immediate summary, optional opening assumption, participant public position and private concern now use separate plain-text tasks. Code assembles the world artifact and records allowed source references; [source-access isolation](./docs/world-access-qualification.md) and the fresh `notes.txt` Ornith journey passed through two rounds and ready analysis. A prior no-entered-cast Ornith scenario also prepared a ready world with four generated participants. | A wider prompt-quality sample remains a follow-up; one opening repeated its setting in the summary without breaking the accepted world contract. |
| Simulation | Generate each event and action candidate in bounded units; for a Planner action, request its label, use condition and expected outcome separately, then assign its code-owned ID. Select known actors, actions and source references by index from explicit lists instead of asking for an event-sized JSON object. Keep intent, speech/action, memory and visibility in distinct actor state fields. Compare previous and current situations/actions with a `1/0` progress decision. Commit a round only after its required actor decisions and visible interactions are complete, then let code assemble events and run artifacts in causal order. Manual and automatic controls obey max rounds unless autonomous continuation is enabled. If nonessential retained-memory extraction stays incomplete after bounded retries, warn and preserve prior memory plus accepted visible history rather than failing the world. | Execution and controls implemented; previous/current progress uses `1/0`. Planner now streams and accepts action label, use condition and expected outcome separately, then code assigns the action ID and assembles the map. A field-local retry retains accepted siblings; a fresh Ornith browser run completed two rounds and reached ready analysis with this path. Completed long labels receive a bounded display name in code. Retained memory now requests one exact quote or 0, a finite record kind, and optional closure index/quote in separate calls; code assembles the update and keeps accepted earlier records if a later field is incomplete. Focused memory, audience and persistence tests pass; bounded [memory](./docs/memory-qualification.md) and [event-recipient](./docs/event-audience-qualification.md) checks previously passed. | The new memory contract completed in a fresh live single-world run; manual/automatic controls and visibility have browser and logic coverage. The observed live worlds had no exact repeated speech or private-goal text in peers' visible context. Broader semantic repetition and leakage evaluation remains follow-up quality work. |
| Report | Reduce source claims and actual round observations into bounded evidence summaries first; terminal reasons remain interpretations, not observed actions, and empty internal findings do not erase observations. Run independent Frontier Tree branches for SWOT and other sections as soon as their inputs are ready. Within each branch, generate an overview, select a bounded finding count and source index, then write one finding and one uncertainty at a time. Generate scenario-direction vocabulary as separate count, label and causal-description fields; classify each world with one supplied category index (`0` means unclassified). Select radar scores from bounded choices. Keep branch prose short-to-medium; use medium-to-long prose only for final detail. Retain each accepted result and its provenance in graph state; code owns section/reference IDs, chart data, coverage counts and assembled report JSON. The report is ready only when required sections and conclusions are complete. Show performance metrics and distinguish simulated outcomes from real-world predictions. | Analysis generation, charts and report UI implemented. Evidence summaries, perspectives, SWOT findings/scores, trajectory vocabulary and world classification, and six scoped conclusion fields now use text or finite-choice tasks with code-owned IDs and references. Targeted Ornith calls accepted perspective and conclusion fields; an earlier complete two-world report reached coverage `2/2/2`. Findings and trajectory-vocabulary conversion have focused tests and report API integration; fresh Ornith single-world and two-world reports both finished with all nine sections ready. | Review provenance wording and chart values on additional small scenarios. A task-local parenthesized evidence-alias cleanup was added after the passing live server started, so it is covered by a focused test rather than that live run. |
| Live UI | Streaming scenario board and single-page report with stage/task/output rows, result cards and read-only detail dialogs; lightweight motion. | Streaming and viewing components implemented. Live generation previews now project plain-text drafts and accepted scalar text directly, with retry/reconnect tests; the earlier browser suite passed 31 mock tests and an earlier Ornith journey reached ready reports. | A selected plain-text task draft is verified through the SSE response, while browser regressions cover selection, retry replacement and failed/empty views. Broader visual quality checks remain follow-up work. |
| Multiverse | The user can toggle Multiverse and choose a world count including 50. Run ScenarioBuilder once, then create separate StoryBuilder state and downstream simulation state for each world. Generate or select each world's evidence in bounded units; launch independent ready worlds and report branches under Fast Mode, while `settings.concurrency` limits simultaneous model calls. Wait for the relevant accepted world summaries before aggregating common and rare **directions of events**, then classify worlds by supplied indices and let code assemble the aggregate report and truthful requested/completed/analyzed counts. One incomplete world must not be silently reported as analyzed. World count does not equal model-call concurrency. | The UI toggle and world-selection browser regression passed. A two-world Ornith browser run reused one confirmed scenario and produced a ready nine-section aggregate report with requested/completed/analyzed coverage `2/2/2`. The store test creates 50 distinct world slots. | The live two-world aggregate and its common direction were reviewed against both world records. Live 50-world capacity and latency certification remain deferred. |
| Whole-flow Ornith acceptance | Demonstrate upload → confirmed scenario → world → interactions → complete report using local `ornith-1.5-35b-a3b`. Each required stage must advance from accepted outputs and expose any incomplete unit clearly. | The latest isolated `notes.txt` browser suite passed after the field and output-budget changes: confirmed scenario, prepared world, two completed actor rounds, ready commentary and a ready nine-section report; a second run reused the confirmed scenario for two worlds and produced a ready aggregate report with coverage `2/2/2`. Browser regressions cover empty cast, optional preset/context, locked traits, and manual/automatic rounds with the deterministic provider. | The small source review retained the May 12 launch choice and 120 million KRW budget without asserting a real-world outcome. Parenthesized alias cleanup has focused coverage; broader model-failure and semantic quality sampling remains follow-up work. |

Keep only each task's needed context in state and prompts, use purpose-named prompt
files and program-owned flat context blocks, and group related text when a separate call
per sentence would add needless cost. A complete response is not proof of factual
accuracy: inspect the small demo against its source and correct observed errors without
adding a general semantic-validation subsystem. Fast Mode runs independent page,
scenario/report-branch and world work in parallel only when their inputs are ready;
`settings.concurrency` limits actual model calls, so 50 worlds do not imply 50
simultaneous inference requests.

## 2. Work order

| Order | Deliverable | Finish when |
| --- | --- | --- |
| 1 | Simplify active model-output contracts | Each affected module accumulates small responses in state and code assembles its result; unnecessary review/rejection loops are removed. |
| 2 | Complete one small single-world journey | A small TXT/PDF, 2–3 actors and 2–3 rounds reach a usable report through the UI using Ornith. Fix blockers at their owner, then retry the affected path. |
| 3 | Check remaining required inputs and controls | Tiny examples cover all eight formats, optional/locked participant inputs, manual/automatic rounds, streaming and visible failure behavior. |
| 4 | Complete multiverse behavior | A small live batch demonstrates shared scenario reuse, independent worlds and aggregate analysis. Verify that selecting 50 creates 50 world jobs under the configured call limit. |
| 5 | Handoff | Required checks pass, local startup instructions work, and the demo results and known limits are recorded. |

After each module, report only: completed user behavior, verification performed, remaining
blocker and next action. Do not add new architecture work merely because a possible future
failure was discovered. Avoid repeating successful tests unless relevant code changes.

## 3. Verification and PoC completion

- Functional/model and end-to-end tests use local LM Studio **`ornith-1.5-35b-a3b`**.
  Do not substitute Gemma or change saved user settings. If unavailable, report the gap.
- Use small synthetic files in [sample-input-items](./sample-input-items/README.md).
  Start with concurrency 1; use a small measured allowance for parallel checks.
- Pure parsing/state tests can be deterministic. Existing mock tests are supplementary;
  `bun run test:e2e` currently enables a mock model and does not prove live acceptance.
  Use an isolated live browser setup for the PoC demonstration.
- Run focused tests, `bun run typecheck`, `bun run lint`, and `bun run build` as relevant.
  Record actual commands, model ID, input, outcome, call count and elapsed time. Do not
  introduce a benchmark program or large fault matrix as a condition of this PoC.
- Observed on 2026-09-24: `bunx playwright test -c playwright.live.config.ts --reporter=line`
  passed both `notes.txt` browser journeys with loaded `ornith-1.5-35b-a3b` in about
  12.7 minutes. The single-world path recorded 125 model-call metrics across shared
  preparation, world preparation, execution and analysis; the two-world continuation
  recorded 141 more. These are recorded call attempts, including any retries, for this small
  synthetic run only. `SIMULA_OFFICE_INTEGRATION=1 bun test src/backend/runtime/documents.test.ts`
  passed six tests, including all eight file formats, in about 6.7 seconds with the
  test model for visual pages. A separate isolated live HTTP probe generated nonempty
  Ornith page interpretations for one selectable PDF, one image-only PDF and one DOCX.
  `bun run test:e2e` passed 31 mock-browser tests; it is supplementary evidence.
- After converting source evidence into short text and finite-choice tasks, the focused
  `--grep 'tiny document scenario'` live browser test passed with local
  `ornith-1.5-35b-a3b` and `notes.txt` in 6.6 minutes. It reached a confirmed scenario,
  prepared world, two completed actor rounds and ready analysis. Final `bun test` passed
  459 tests with one optional Office test skipped; typecheck, lint and build passed.
  The full mock browser suite passed all 31 tests after its source-fact selector was
  scoped to the first matching fact.
- After converting Planner action generation to three streamed plain-text fields,
  the same focused live `notes.txt` browser journey passed with local
  `ornith-1.5-35b-a3b` in 6.9 minutes. It reached two completed rounds and ready
  analysis. The changed action workflow passed focused field-retry and collision tests;
  a deterministic check covers shortening a long label without an incomplete phrase.
  Final checks for this change: `bun test` passed 456 tests with one optional Office
  test skipped; `bun run typecheck`, `bun run lint`, `bun run build`, and all 31
  mock browser tests passed.
- The first post-StoryBuilder live run prepared a world and completed two rounds, but
  its analysis was partial: a two-child world-observation synthesis hit a 256-token
  output ceiling on all three attempts. Replaying those accepted child summaries with
  Ornith at 2,048 tokens completed on the first call with eight observation references.
  The subsequent full `notes.txt` browser run passed to ready analysis in 6.5 minutes.
  `bun test` passed 460 tests with one optional Office test skipped; typecheck, lint
  and build passed; the full mock browser suite passed all 31 tests after the
  output-budget change.
- After perspective and conclusion field conversion, targeted local Ornith calls
  accepted all four perspective fields and all six scoped conclusion fields. The
  complete integrated implication sentence was 376 characters, so code now uses it
  directly as the final summary instead of rejecting it at a 160-character part limit.
  `bun test` passed 463 tests with one optional Office test skipped; typecheck, lint,
  build and all 31 mock browser tests passed. A fresh full live journey after these
  report-field changes remains to be run before claiming their end-to-end acceptance.

- A fresh isolated live browser suite after stepwise findings, trajectory, memory and commentary changes passed both `notes.txt` Ornith journeys in 16.4 minutes. The single world completed two actor rounds, retained `reportCommentary.status = ready`, and produced nine ready analysis sections. The two-world batch reused one confirmed scenario, completed two worlds, and produced nine ready sections with coverage `2/2/2`. An earlier live attempt exposed complete commentary prose rejected by a 1,200-character cap and two branch overviews rejected by a 500-character cap; after increasing these resource bounds, targeted Ornith replays made the same saved commentary and analysis ready, and the fresh suite passed. Parenthesized evidence-alias cleanup was added after this live server started and has a focused deterministic test.

- Final deterministic checks after the citation cleanup: `bun test` passed 472 tests with one optional Office integration test skipped; `bun run typecheck`, `bun run lint`, `bun run build` passed; `bun run test:e2e` passed all 31 browser tests. A focused browser rerun confirmed the no-entered-cast meeting preset and generated role cards.

- The current Office integration test passed all eight small input formats. A fresh local Ornith VLM check made `overview.pdf` ready with one extracted text block and one visual interpretation block; image-only `scanned-note.pdf` became ready with its visual interpretation. Both used the configured provider and temporary isolated document storage.

- The final visible-output boundary check streamed a selected plain-text task through the actual SSE response and asserted its display field. Live run inspection found no exact repeated speech across its tested rounds and no exact private-goal text in another actor's visible context; this is a bounded check, not exhaustive semantic privacy proof.

- The built application started with `bun run start` against an isolated data directory; both `/` and `/api/settings` returned HTTP 200. The temporary server and data directory were removed after this check.

**PoC is complete when** the required journey and controls above work on the small inputs,
stepwise generation assembles usable results, a small multiverse run produces an aggregate
report, and known limits are documented. No unresolved defect may prevent the demonstration
or expose another actor's private state in the tested flow. A full 50-world live load test
and target-VDI performance certification are follow-up capacity work, not this completion gate.

## 4. Deferred work and reference material

Defer multi-process admission/storage coordination, durable mid-run restart, long-history
archive/retrieval, exhaustive semantic leakage checks, high-load benchmarks and VDI-specific
tuning. The legacy top-level simulation graph still carries its bounded authoritative state;
a broader reference-only checkpoint migration is not needed for this demonstrated PoC. Keep existing implementations; do not remove them solely to simplify the plan.
Only bring deferred work back if an observed PoC blocker requires it.

[Detailed design](./docs/system-adv-specification.md) preserves earlier ideas, but its extra
contracts, JSON-generation examples and release gates do not override this PoC plan.
[Work history](./docs/system-adv-progress.md) and the existing module qualification records
preserve past results. Neither is an additional completion checklist.
