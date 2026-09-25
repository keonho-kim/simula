# Model Design

`simula` routes model calls through named roles. Each role has its own provider, model, sampling,
timeout, and token settings.

## Roles

| Role | Responsibility |
| --- | --- |
| `storyBuilder` | draft a scenario from user messages before a run is created |
| `planner` | interpret the scenario and build scenario digest, event plan, and runtime direction |
| `generator` | build roster entries and actor cards |
| `coordinator` | coordinate runtime rounds and event progress |
| `actor` | produce actor choices, messages, and context updates |
| `observer` | summarize rounds and contribute report-ready observations |
| `repair` | recover malformed structured responses when a stage allows repair |

Role separation keeps prompts small and makes per-stage provider choices explicit.

## Providers

Supported providers are:

- `openai`
- `anthropic`
- `gemini`
- `ollama`
- `lmstudio`
- `vllm`
- `litellm`

`ollama`, `lmstudio`, `vllm`, and `litellm` are OpenAI-compatible providers and require a base URL.
Other providers require an API key.

## Inputs and Outputs

Model calls receive compact stage-specific inputs:

- planning receives the scenario text and scenario controls
- generator calls receive the plan and one roster or actor-card task
- coordinator calls receive current world state, event pressure, and round context
- actor calls receive one actor plus visible context and allowed actions
- observer calls receive round or completed-state context

Accepted outputs are parsed, validated, normalized, and then merged into workflow state. Machine
tokens such as actor ids and action ids remain exact even when the prompt language is Korean.
The actor's thought request includes its own bounded initial private concern separately
from the lossy memory summary. Peer actor profiles do not contain that concern. This
preserves the starting concern through later rounds without granting source or event
knowledge beyond the current visibility rules.
When an injected event has an explicit actor audience, excluded actors receive a neutral
current-situation cue in place of its title and summary. Their compression requests also
omit the event. Accepted speech can subsequently disclose its content through the
ordinary private or public interaction boundary. Planner-generated events remain public
until a confirmed entitlement owner supplies scoped audiences.

## Bounded invocation and image inputs

Role invocations accept a per-call output-token ceiling, response-byte ceiling, and
AbortSignal. The output ceiling cannot increase the configured role limit or mutate
settings shared with another invocation. Shared generation and exact-choice calls
allow 2,048 output tokens by default; direct role calls use their configured limits.
Prompts guide the desired answer length, while genuinely truncated output retries its
own field without discarding accepted siblings.

The stream collector applies a total deadline across connection and streaming, forwards
cancellation to the provider, and rejects late output after cancellation. Visible text
and reasoning share a 128 KiB default response-memory allowance. Provider token usage
remains unavailable when it is not supplied. Existing TTFT semantics are preserved.

The role input adapter also accepts text/image content blocks. `createVisionInput`
encodes one PNG/JPEG/WebP region of at most 8 MiB as an inline image. Document extraction
must separately validate and render image dimensions before this adapter is called.
Local transport tests verify payloads and ceilings; they do not establish model vision
quality. Document upload and extraction are tracked in the expansion plan.

Document-grounded scenario, world-preparation, and analytical tasks use one maximum
of three attempts across malformed content and transient transport failures. The
provider adapter honors a short Retry-After hint or applies bounded jittered backoff
after releasing model admission; the next attempt must reacquire capacity. Provider
SDK retries stay disabled. Other simulation-role retry contracts are unchanged.

For short text or choice `storyBuilder` tasks on LM Studio, the generation adapter sends
`reasoning_effort: none` through the existing OpenAI-compatible route when the role
does not specify a reasoning effort or an explicit provider-specific value in
`extraBody`. This applies to evidence, digests, facets, situations, rosters,
participants and rules. Detailed report writing and `observer` calls keep
their configured behavior. The per-task choice does not mutate saved role settings;
the task fingerprint includes this policy so older cached results are not silently
reused across the change. The model still has to support the parameter; an unsupported
request fails at the provider boundary rather than switching behavior unnoticed.

The common executor replaces canonical evidence IDs with short task-local aliases
(`E1`, `E2`, and so on) in model context. The model returns one plain-text field or
finite choice; code attaches the permitted canonical references to accepted artifacts.
ScenarioBuilder source claims receive their source-block IDs in code and carry them
through bounded reduction. Parenthesized task-local aliases in prose are removed,
while ordinary source terms remain. No generated citation array is parsed from model output.

## Metrics

Every model-backed step emits `model.metrics` when it completes. Metrics include:

- role
- step
- attempt
- time to first token
- duration
- input/output/total token counts when available
- whether token data came from the provider or was unavailable

These events are written to `events.jsonl` and streamed to the web app.

## Recovery

Stages retry empty or malformed responses where the current workflow defines a retry path. When a
repair path exists, the `repair` role receives the invalid output and allowed shape. If recovery is
not possible, the run fails explicitly.

Runtime may use explicit no-action behavior only where that behavior is part of the current actor
decision contract.

## Related Docs

- configuration: [`configuration.md`](./configuration.md)
- contracts: [`contracts.md`](./contracts.md)
- workflow stages: [`workflows/README.md`](./workflows/README.md)


## Small-model action catalog generation

Planner generates actions sequentially within each visibility scope. For each action it
requests a short label, then one use-condition sentence (`intentHint`), then one attempted
effect sentence (`expectedOutcome`). The model emits plain text for each field; application
code assembles the action object, ID and visibility only after all three fields complete.
The label prompt sees accepted labels and purposes, while the later prompts see the accepted
label and use condition. Solitary labels exclude dialogue and joint agreements.

Each field has at most five attempts. An incomplete or truncated field retries without
regenerating its accepted siblings or prior actions. Code bounds completed long labels
and detail sentences, rejects empty text and normalized duplicate labels, and preserves
the scope-specific code map. A persistent cross-scope collision may receive a localized
visibility prefix; a same-scope duplicate is not renamed into an invented extra action.
If a scope already has an accepted action, an unresolved later slot is omitted. The first
action in each scope is required. Transport and cancellation failures still propagate.

Preview SSE forwards the current field's text directly; retry resets only that field.
Default three actions per scope require 36 initial small model calls, compared with the
former 12 JSON calls. This is a deliberate PoC tradeoff for bounded outputs and field-local
retries; provider-specific JSON response-format flags are not used.

Actor selection continues to use the existing short exact-choice responses, allowed-output
validation, and repair role. The default catalog has twelve codes plus `no_action`, and a solitary
Actor can select only solitary actions. Visibility is fixed per code to avoid adding another
selection call or requiring a multi-field response from smaller models.

Automated verification uses deterministic provider responses and malformed-response fixtures.
These checks establish protocol behavior, not measured semantic quality or reliability on an
actual 27B (or smaller) model; that requires evaluation with the intended local model.

## Actor thought, intent, and speech

Actor text prompts distinguish private interpretation (`thought`), the purpose of the chosen
behavior (`intent`), and recipient-facing dialogue (`message`). Intent receives the preceding
thought, current event, and pre-round context. Speech receives event context alongside thought,
intent, action, and target. Korean and English instructions include one connected role example;
only the current step is requested, and the example's content must not be copied. Honest speech
is allowed; actors are not required to invent hidden motives or contradict their thoughts.

Speech validation rejects only whole-response copies of thought or intent, after Unicode,
case, whitespace, and punctuation normalization. It does not reject semantic similarity or
shared phrases. A rejected response receives localized feedback identifying the copied field
and asking for recipient-facing speech while retaining the previous decisions. Only speech is
retried, with at most three total attempts. Exhaustion fails explicitly without inventing a
replacement line. Existing silence and no-action behavior is preserved; target and action
exact-choice validation and repair remain unchanged.

## Report interpretation

Report commentary uses the configured observer model and existing provider invocation path.
No additional provider or model role is required. Generation adds bounded calls after simulation:
round evidence packets first, then four-way reduction frontiers with a detailed-conclusion level
and an overall-conclusion level. At most two independent nodes progress at once. Each node
requests a summary, one finite finding count, separate finding sentences and a conclusion;
each field has at most three attempts. Code attaches evidence IDs and retains accepted fields
when a later field is incomplete. Prompts distinguish recorded evidence from inference and
state uncertainty when child analyses are missing. No model calls are made merely by viewing an existing report;
the user can explicitly generate/retry commentary. Deterministic simulation results remain usable
when generation is unavailable.

## Shared ScenarioBuilder generation

After the information rule and cast are accepted, ScenarioBuilder asks one short
source-access question per grounded claim. Ornith returns `0` for public, `?` for
unresolved, or comma-separated numbers from the supplied participant list. Code resolves
the numbers to exact participant IDs, retains the accepted source wording and citations,
and assembles the `sourceFacts` JSON artifact. Each fact is saved independently, so a
failed or corrected choice does not regenerate an accepted sibling. The answer must be
complete and within the supplied list; three bounded attempts repair only that answer.
Deterministic assembly blocks unresolved access or a direct restricted-claim copy in
public prose. The browser shows the
assignments before confirmation. Prepared worlds consume these grants through their
existing source-access boundary. Semantic paraphrases remain an observed-quality issue.

The document-grounded builder uses the existing `storyBuilder` provider configuration
with bounded per-call output. It requests one short claim per source block, one overview
and one explicit gap or `0` per group. Code attaches source IDs, keeps accepted
claims, and uses a finite list of indices to select up to four claims when a
three-child reduction frontier contains more. Extracted PDF text governs conflicting
visual-page quantities. Evidence summaries and scenario facets have bounded serialized
sizes so synthesis packets remain bounded.
The input guard is character-based; target-model tokenization/context calibration remains
an acceptance requirement.

The common executor accepts only plain text or finite choices and applies the relevant
schema and source-membership checks to code-assembled values. Each content task has at
most three attempts. Empty or truncated output never becomes accepted evidence.
Locked personality text is preserved by code and is not regenerated by the model.
When personality is absent, ScenarioBuilder generates it as one short text task, then
generates authority and goal as separate text tasks. Code binds those fields to the
accepted name and locked flags; the model does not author the participant JSON object.
Facets and rules are also short text tasks: code marks generated facet details as
scenario assumptions and stores each accepted rule as one `entries` item. An omitted
cast uses one finite count choice and one short name task per slot; duplicate or
sentence-like names retry locally before code assembles the roster JSON artifact.

Targeted repairs address incomplete tasks or observed access issues without routine
LLM re-review of every response. Unchanged siblings are reused by fingerprint;
remaining blocking issues leave a blocked draft. Real-model factual entailment and
broader document understanding remain outside the small-input evidence in System-Adv.md.

Per-world StoryBuilder requests the public opening's setting, immediate summary and
optional realized assumption separately. It then requests each participant's public
initial position and private immediate concern as short text tasks. Code assembles
their artifact fields and permitted source references; the model no longer writes a
world-opening or participant JSON object. Public tasks receive only public facts,
while a private concern receives only its owner's granted facts. The compact world
graph retains references to the accepted artifacts and assembles the world after the
required units complete.

## Admission and cancellation

Runtime execution scopes supply an owner ID, abort signal, and shared model admission
contract to the central invocation boundary. Ordinary prose, exact choices, images, and
streaming calls use that same boundary. Pool identity uses the effective endpoint and
model, excluding credentials and provider aliases. Model creation starts only after
admission; queue wait is excluded from provider TTFT and duration.

SDK automatic retries are disabled. A caller's explicit retry must obtain another
permit, and no permit survives response failure or local cancellation. Queue capacity
and deadlines bound pending requests. The limits and ownership are configured in the
server composition root, not stored in graph checkpoints or browser settings.

The asynchronous propagation contract uses
[Node AsyncLocalStorage.run](https://nodejs.org/api/async_context.html#asynclocalstoragerunstore-callback-args)
and is exercised through real LangGraph nodes and controlled HTTP requests in the
installed Bun runtime. The 50-call test demonstrates client admission capability, not
target-model throughput, inference parallelism, or complete Multiverse execution.

## Analytical reports

The analytical backend uses the configured Observer through the same generation
executor as the builders. Evidence uses short text units in a three-child reduction;
SWOT scores use one finite `0`–`4` or `?` choice, and code retains their rationale
and references. Each shared generation request now has a 2,048-token completion
allowance, including short text, choices, findings, and final detail. Prompts specify
the intended short or medium response; a narrow token ceiling does not stand in for
that guidance. The stored evidence digest remains bounded by its schema and keeps
program-owned observation references. The shared report perspective is built from
four short text fields and code-owned references. Integrated conclusions use a short
summary and one prose paragraph for each of source, simulated observations and
implications; code assembles the final section and its references. The implications
summary is the integrated takeaway, rather than a concatenation of three summaries.
The complete prompt, including schema/reference lists and repair feedback, is guarded
at 16,000 characters; this remains a character guard, not calibrated model tokenization.

Each content unit receives at most three attempts. Complete text and finite choices
are accepted without routine model re-review. Matching accepted artifacts survive retries;
changed descendants alter parent inputs and invalidate their cached result. A branch
failure preserves successful siblings and produces an explicitly partial report.
Source-reference checks establish membership, not factual entailment. Evidence reduction
with observed actions must retain at least one observation reference; this prevents an
actor-definition-only summary from dropping all actual simulation observations, but does
not prove complete semantic coverage.

SWOT branches share one perspective and the 0–4 ordinal influence rubric. Unknown is
`null`, never zero. Trajectory categories are proposed and merged in bounded calls, then
worlds are classified against program-owned category IDs. Code counts distinct worlds;
the model does not calculate probabilities or invent frequencies. The final report
distinguishes source claims, scenario assumptions, observations, and interpretations.

One execution attempt permits at most 4,096 model calls and 60 minutes. These are backend
limits, not a completed user-facing budget product. Report metrics record reported usage
for incurred generation calls; shared preparation/batch-wide aggregation and unknown
failed-request usage still require the global accounting work. Deterministic tests prove
contracts and isolation, not quality on the intended small-model deployment.

## Prompt ownership and input blocks

Each model-generation purpose has one file under its owner's `prompts/` directory.
Use domain filenames such as `thought.ts`, `message.ts`, `label.ts`,
`check-source.ts`, and `page-interpretation.ts`; do not collect unrelated templates in
`prompts.ts` or name files `xxPrompt.ts`. Language variants of the same request stay
together. A prompt-family index selects existing workflow steps; it contains no prompt
prose. Shared context projections may be reused, while invocation, state transitions,
validation, and retries remain with their existing workflow owners.

Actor retry instructions follow the same ownership: `retry-section.ts` corrects mixed
decision stages and `retry-message.ts` corrects empty or copied speech. The actor node
detects the issue and inserts the generated correction into an escaped `FEEDBACK`
block; prompt builders neither validate responses nor invoke models.

Legacy report commentary keeps evidence-item, detailed-conclusion, and
overall-conclusion guidance in separate files. Its summary, finding-count, finding,
and conclusion prompts share one context formatter; its node workflow assembles fields.

`core/prompts/blocks.ts` renders program-owned, top-level input delimiters. No nested
XML is produced. Payloads are plain text or serialized JSON; embedded angle brackets
are escaped so source text cannot close a block or add another block. This preserves
structural boundaries, not a guarantee that a model will obey every instruction.

| Block | Meaning |
| --- | --- |
| `SOURCE` | Original material or source-linked summaries, with provenance retained |
| `USER_INPUT` | User requests and explicitly supplied constraints |
| `SCENARIO` | Hypothetical setup, generated scenario facts and participants |
| `SIMULATION` | Recorded simulated events, interactions and world outcomes |
| `ACTOR` / `HISTORY` | Actor identity/profile and only the history visible to that actor |
| `PREVIOUS_RESULT` | Earlier model output used by the next generation unit |
| `ANALYSIS` | Interpretations, assessments and accepted child analyses |
| `OPTIONS` | Finite choices and their selection context |
| `REVIEW_TARGET` | The specific candidate claim or response being checked |
| `PREVIOUS_STATE` / `CURRENT_STATE` | Consecutive states for binary progress comparison |
| `INFO` / `CONSTRAINTS` / `FEEDBACK` | Task metadata, fixed boundaries and local correction feedback |

Callers explicitly classify context before the generation executor formats it. The
executor does not guess provenance from field names. Report evidence projections use
stored document/run/category provenance; source material and simulated results remain
separate throughout findings, semantic checks and final conclusions. Source summaries
remain summaries of supplied material, not newly verified real-world evidence.

Instructions and output contracts stay outside the context blocks. Models return
one exact choice or prose unit; they are never asked to emit XML or a stage-sized JSON object.
Story Builder separates user messages from assistant drafts and preserves original
message indices so revision order is not lost. Prompt changes alter accepted-task
fingerprints naturally; accepted artifacts are reused only when the current inputs and
instructions still match.

## Retained actor memory

Before free-text compression, and after a round's interactions commit, actors ingest
unprocessed visible entries. `actors/prompts/memory-addition.ts` asks for one exact
quote or `0`; `memory-kind.ts` classifies each accepted quote by finite choice.
Identical accepted interaction content for multiple permitted readers shares the
addition work; `memory-closure.ts` selects an active record by index and
`memory-closure-quote.ts` asks for its later visible closure words. Readers share closure work
only when their current evidence and complete active-record inputs are identical, including
source interaction identity. Different private knowledge remains in separate groups.
Program-owned R1/R2 aliases map accepted closures back to each reader's local IDs. The
shared additions request contains no prior private ledger or author-only intent and expectation.
Every request uses flat program-owned input blocks, and source-language quotes remain
exact, including numbers and conditions. No result is shared across worlds or runs.

Code assembles at most three additions and three closures per entry, with exact quotes of
4–240 characters. Additions classify commitments, decisions, authority, constraints
and unresolved issues. A closure must select an existing active record and cite later
visible words. The prompt excludes proposals, internal intentions, silence and repeated
wording as evidence of fulfillment. Code checks schema, exact quote membership, record
scope, duplicates and output truncation; semantic correctness still requires target-model
qualification. An empty result cannot erase an earlier record.

Each extraction or closure task has at most three content attempts and uses the configured
actor output allowance. Provider failure/cancellation propagates through the existing invocation boundary.
Accepted entries are skipped using the actor-local cursor. Calls and retries retain the
existing `actor` role, `context` step and invocation telemetry. Five public interactions
read by four other actors use five shared extraction calls instead of 20; author-specific
work and any reader-specific closure calls remain additional. Fast mode gates independent
memory tasks; provider admission still owns the global allowance. The bounded local
[Ornith qualification](./memory-qualification.md) measures extraction and closure together;
it does not qualify all scenarios, author processing, compression or end-to-end throughput.

Current safety bounds are 6,000 input characters per visible entry, 14,000 characters
per complete retention request, 24 active records and 256 retained records per actor.
Exceeding these bounds fails explicitly rather than evicting an unresolved promise.
Longer-run retrieval/archive policies and model-specific budget calibration remain open.
Records and their cursor serialize with canonical run state; mid-round replay and
crash-safe per-entry acceptance are not implemented by these snapshots.
