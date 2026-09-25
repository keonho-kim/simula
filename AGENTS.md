# Simula Development Rules

This file applies to the entire repository. It defines the default rules for humans and coding agents acting as lead engineers on this open source project. Prefer the smallest correct change that preserves these rules.

`simula` is a TypeScript agent-based virtual simulation system with a Next.js/Node web server and Bun tooling. Its virtual world is driven by actors with explicit state, intent, memory, relationships, and interactions. The visual design authority is `DESIGN.md`.

## 1. Priorities

When rules compete, use this order:

1. Correctness, including security and privacy
2. Simplicity
3. Clear behavior and ownership
4. Readability
5. Debuggability
6. Conceptual integrity and architecture boundaries
7. Consistency with existing repository patterns

Do not trade a higher priority for a lower one without an explicit repository decision. Do not prioritize cleverness, speculative extensibility, transition comfort, or theoretical completeness over these priorities.

## 2. Clean and minimal code

- Implement only what the current task requires. Every module, type, option, state, interface, and dependency must serve a concrete current need and have a current caller or test.
- Prefer a small function and plain data over a class or framework. Use classes only for identity, lifecycle, encapsulated mutable state, or a framework contract.
- Reuse existing code and components before adding new ones.
- Keep modules cohesive and control flow explicit. Prefer early returns and visible failure paths.
- Use names that describe domain meaning. Avoid generic `data`, `item`, `manager`, `helper`, `utils`, or `service` names when a precise name exists.
- Export only what another module needs. Prefer named exports in product code; use default exports only when a framework or configuration format requires them. Barrel files must define an intentional public boundary.
- Remove dead code, commented-out code, unused exports, obsolete compatibility branches, and unnecessary indirection within the responsibility being changed.
- Do not duplicate domain rules. Extract shared behavior only when a stable rule has at least two real consumers.
- Do not hide I/O, mutation, timers, logging, or global state behind pure-looking functions.
- Write for developers with less than three years of experience. Comments explain intent, constraints, and non-obvious tradeoffs rather than restating code.

### 2.1 Hard file-size limit

- Every authored script or code file is limited to **350 physical lines**, including comments, blank lines, imports, and the mandatory header.
- The limit applies to `.ts`, `.tsx`, `.js`, `.mjs`, `.mts`, `.cjs`, `.sh`, `.py`, `.yml`, and `.yaml` files. Generated files, lockfiles, vendored code, and strict data formats are exempt.
- Treat 280 lines as the review threshold. Before adding more, identify the next coherent responsibility that can move to its own module.
- If a file changed for production behavior already exceeds 350 lines, split the responsibility as part of the change before adding behavior. Do not broaden a documentation-only or unrelated mechanical task solely to remediate a legacy violation.
- Split by responsibility, ownership, runtime boundary, use case, adapter, state transition, or rendering layer. Never create numbered parts, dense one-liners, trivial forwarding files, or unrelated moves to satisfy the limit.
- Do not mechanically split generated code, localization dictionaries, fixtures, or cohesive declarative data. When such a file is exempt, keep its organization reviewable and document why it remains cohesive if it is changed substantially.

### 2.2 Engineering principles

| Principle | Required behavior |
| --- | --- |
| YAGNI | Every abstraction, option, interface, state, and dependency serves a current requirement. Delete unused future hooks. |
| KISS | Prefer the smallest design that clearly satisfies the behavior and boundary. Use direct code before generic machinery. |
| DRY | Share stable domain knowledge with at least two real consumers; do not abstract merely similar syntax. |
| SRP | Give each module one reason to change. Separate domain policy, I/O, state transitions, and presentation. |
| DIP | Domain and application policy depend on narrow consumer-owned contracts, not transport, storage, provider, or UI implementations. |
| ISP | Keep public contracts narrow. Consumers must not depend on methods or data they do not use. |
| Fail Fast | Parse untrusted input at the boundary and stop on invalid state. Do not carry partial or ambiguous state deeper into the system. |
| Least Knowledge | Collaborate through direct contracts; do not reach through another object or layer to manipulate its internals. |
| Explicitness | Make state ownership, side effects, cancellation, and failure visible in types and control flow. |
| Single Source of Truth | Give each domain rule, configuration value, and event contract one owner; derive secondary views. |
| Information Hiding | Hide volatile implementation details behind a useful module contract, without pass-through layers. |
| Parse, Don't Validate | Convert untrusted or weakly typed input into trusted domain types at the boundary instead of passing a merely validated DTO inward. |
| Code Health | Improve the responsibility being changed without expanding into unrelated cleanup. |

YAGNI takes precedence over speculative Open/Closed Principle designs. A named pattern is never sufficient justification for an abstraction.

### 2.3 Mandatory pre-edit review

Before the first edit to an authored code file, inspect the target, imports, callers, exports, contracts, directly related code, and tests. For a new file, inspect its intended owner and collaborators. State the requested observable behavior and record this decision in the work update:

```text
Responsibility: one sentence describing the behavior this module owns
Placement: target path and runtime/dependency boundary
Pattern: smallest fitting pattern or Simple Module, and why
Collaborators: direct dependencies, public contract, and side effects
Split: keep or split, with a responsibility-based reason
Size: current physical line count and expected line count after the change
Validation: observable behavior or contract to verify
```

- Write user-facing updates in Korean; translate these labels as needed.
- One review may cover a cohesive change across several files. Do not produce repetitive per-file paperwork.
- Confirm the behavior belongs in the chosen directory and whether it introduces a second reason to change.
- Prefer a new cohesive module when the target would cross 350 lines or mix responsibilities.
- Decide placement and pattern before implementation, then revisit the decision using section 5.
- Documentation-only, wording-only, and mechanical changes need a brief scope and validation statement, not a forced design-pattern review.

## 3. Mandatory script header

Every authored script or code file that supports comments must begin with a short header before imports or executable statements. For an existing unmodified file, do not create an unrelated header-only diff; add or correct the header whenever the file is changed.

Use this format before imports, after any required shebang:

```ts
/**
 * Purpose: What this file is responsible for.
 * Pattern: The primary design pattern or structural role used here.
 * Usage: How the file is invoked, imported, or operated.
 * Related: Repository-relative paths of directly related files, or "None".
 */
```

- `Purpose`, `Pattern`, `Usage`, and `Related` are always required; keep the complete header between 4 and 8 lines.
- `Purpose` describes one current responsibility, not project history. `Pattern` names a real pattern or role; use `Simple Module` when no named pattern improves understanding.
- `Usage` gives the real Bun command, runtime entry, or import relationship. `Related` lists the closest collaborators as repository-relative paths; use `None` only when there is no direct collaborator.
- Put a shell or Python shebang first and the four fields immediately after it. Use the file's native comment syntax. Generated files and formats that do not allow comments are exempt.
- Keep the header accurate when responsibility, invocation, or collaborators change. Do not merge a newly created or changed authored file with a missing or stale header.
- Record material architecture decisions and tradeoffs in the relevant existing document under `docs/`; do not create an architecture document for every routine edit.

## 4. Source architecture and placement

Organize production source by runtime, then by function and responsibility. Keep existing cohesive modules intact; use submodules only when they clarify ownership. Folder organization does not require new interfaces, wrappers, or framework changes.

```text
src/
├─ app/              # Next.js page routes; browser work stays behind Client Components
├─ backend/
│  ├─ config.ts         # Environment and runtime paths
│  ├─ api/              # Function-grouped HTTP controllers, SSE and WebSocket adapters
│  ├─ runtime/          # Run execution, continuation, temporary event publication
│  ├─ integrations/llm/ # Provider construction, invocation, model discovery, usage
│  ├─ storage/          # Temporary server artifacts and bundled scenario loading
│  │  └─ runs/          # Active run artifacts and timeline publication
│  └─ core/             # Simulation and application domain logic
│     ├─ simulation/
│     │  ├─ workflow/   # Top-level graph, shared state, stages and finalization
│     │  ├─ actors/     # Shared actor memory, interactions and visible text
│     │  ├─ events/     # World event injection and execution telemetry
│     │  ├─ planning/   # Plan digest projections
│     │  ├─ outputs/    # Report and graph timeline derivation
│     │  └─ roles/      # Planner, generator, coordinator, actor, observer
│     │     └─ generator/cards/ # Per-actor card generation workflow
│     ├─ scenario/      # Scenario parsing and normalization
│     ├─ settings/      # Defaults, validation and sanitization
│     ├─ story-builder/ # Scenario drafting workflow
│     └─ prompts/       # Shared prompt and language construction
├─ shared/              # Cross-runtime domain types and API/event contracts
└─ ui/
   ├─ shell/            # Browser startup, application composition and view orchestration
   ├─ animation/        # Motion timing/presets, presence, visibility and CSS feedback policy
   ├─ pages/            # Start, report and browser-level page composition
   ├─ components/       # UI grouped by scenario, settings, graph, activity, etc.
   │  └─ ui/            # Existing shadcn primitives
   ├─ hooks/            # React lifecycle and subscription hooks
   ├─ stores/           # Cross-cutting Zustand state and event projections
   ├─ types/            # Shared browser-only type contracts
   ├─ models/           # Presentation calculations and form-state transformations
   ├─ api-client/       # Outbound HTTP requests and export downloads
   ├─ browser-storage/  # SQLite WASM, OPFS, browser session and preference storage
   ├─ i18n/             # Dictionaries and pure locale resolution
   └─ lib/              # Existing class-name utility
server.ts               # Single Next, API, SSE and WebSocket listener
```

`apps/*` and `packages/*` retain workspace configuration and tests. They are not production source layers. `src/backend/core` owns backend domain logic; it is distinct from the former top-level core entry point. Do not restore old `src/core` or UI `features/widgets/entities` entry points, and do not create empty folders to fill this tree.

| Boundary | Owns | Must not own |
| --- | --- | --- |
| `backend/api` | HTTP request/response handling, settings-to-provider request coordination, SSE transport | Actor decisions, simulation state transitions |
| `backend/runtime` | Execution lifecycle, cancellation, temporary artifacts and event publication coordination | HTTP responses, React state, provider protocols |
| `backend/integrations` | External model API translation, invocation, discovery, usage | Settings file loading, HTTP route dispatch, UI behavior |
| `backend/storage` | Temporary run artifact I/O, process-scoped settings, bundled samples | Browser-owned durable history, HTTP response construction, provider selection |
| `backend/core/simulation` | Actor behavior, accepted interactions, stages, timeline derivation, reports | HTTP transport, browser rendering, filesystem access |
| `backend/core/settings`, `backend/core/scenario` | Domain parsing, normalization, defaults, validation | HTTP responses, UI form state, file access |
| `shared` | Serializable shared types and API/event contracts | Runtime orchestration, platform I/O, provider clients, React |
| `ui/shell`, `ui/pages` | Browser startup, composition, navigation, user workflow orchestration | Authoritative simulation rules, filesystem access |
| `ui/animation` | Shared Motion timing, presence and interaction presets, visibility/reduced-motion policy, native CSS feedback | Page-specific state, navigation policy, domain data |
| `ui/components` | Reusable and feature-specific rendering and interactions | Backend rules, provider credentials, imports from pages or app |
| `ui/hooks`, `ui/stores` | Browser lifecycle, subscriptions, UI state and projections | JSX composition, server authority |
| `ui/models`, `ui/types` | Presentation transformations and browser contracts | Component/page imports, HTTP or storage I/O |
| `ui/api-client`, `ui/browser-storage`, `ui/i18n` | Outbound transport/downloads, SQLite WASM and OPFS persistence, translation data | React page composition, authoritative simulation state |

Dependency and placement rules:

- `shared` imports no backend or browser implementations.
- `server.ts` wires the Next request handler and backend runtime on one listener. API controllers coordinate runtime, storage, and integrations; runtime owns execution, not transport.
- Keep `src/app` limited to Next route and layout entry points. Browser OPFS, SQLite WASM, Web Locks, and their startup stay behind the client component boundary in `src/ui/shell`.
- Simulation and story-builder workflows may call model integrations, while deterministic transformations stay free of I/O. Settings, scenario parsing, and prompt construction do not depend on API or runtime modules.
- Storage may use pure parsing or timeline transformations. Integrations receive resolved connection settings rather than reading browser storage. Active server artifacts are temporary; browser SQLite WASM owns durable history and settings.
- Use each actual graph as a cohesive module: `graph.ts` owns graph construction and edges; `state.ts` owns its state types, annotations, initialization, and state helpers; nodes and prompts stay alongside them. The top-level graph lives in `workflow/`.
- Share the existing `WorkflowState` and annotation from `workflow/state.ts` across planner, generator, and coordinator graphs. Do not duplicate the same schema or add forwarding state declarations to make folders look uniform. Graph-specific actor and card annotations belong in their own `state.ts`.
- Keep shared memory behavior in `actors/memory.ts`. Separate pure transformations and model calls as functions; do not require separate files solely because one function performs I/O. A memory operation or observer function does not need a graph folder unless it actually constructs a graph.
- `roles/generator/cards` owns per-actor card generation; its parent generator owns roster generation and assembly. Keep each role's graph, nodes, state, and prompts cohesive rather than creating generic registries.
- Core workflows may invoke `integrations/llm`; core must not import `api`, `runtime`, `storage`, or browser modules. Integrations may consume pure core settings but must not import simulation orchestration.
- Browser modules consume `shared` contracts and HTTP/SSE. They must not import `backend`.
- UI composition flows from shell/pages to components, animation, hooks, stores, and models. Lower layers must not import shell/pages/components. Local component helpers and rendering-engine code may stay with their component.
- Define reusable Motion timing and effects in `ui/animation`. Components choose an effect and own their rendering, keys, and accessibility. Keep graph canvas interpolation beside its renderer and preserve native focus, scroll, and bounded color feedback.
- Keep component-only props and implementation types local. Move types to `ui/types` when multiple responsibilities share them; do not split every interface into its own file.
- Group components and models by actual function. Do not put all components or all logic in one flat folder, and do not create a generic service layer.
- If no listed location fits, reconsider the responsibility before creating `common`, `utils`, `helpers`, `services`, `managers`, or `misc`; catch-all folders are not architecture.
- Use direct imports across responsibility boundaries. Keep a module index only when it defines an intentional cohesive public contract. Circular imports are forbidden.
- Update affected architecture documentation when a boundary changes. Do not retain old paths as compatibility aliases.
- Remove a directory's `.gitkeep` when its first implementation file is added. Do not create placeholder modules or speculative interfaces merely to fill the tree.

## 5. Design pattern rules

Patterns are tools for demonstrated responsibilities. Choose the smallest pattern that makes ownership, dependencies, and change direction clearer.

### 5.1 Required decision loop

Use this loop for production behavior and structural changes:

1. **Define:** State the exact behavior, single responsibility, invariants, and observable success or failure.
2. **Inspect:** Read the current owner, callers, imports, and tests. Determine whether a local edit or coherent replacement makes the system simpler.
3. **Place:** Choose the runtime and source location using section 4. Identify state ownership and external boundaries.
4. **Choose:** Start with a function or `Simple Module`. Select a named pattern only when it solves a concrete problem. State the benefit and added complexity; for a structural choice, explain why the simpler option is insufficient.
5. **Implement:** Record the pre-edit decision in the mandatory header and work update, define the narrow public contract, and implement only the current requirement. Add a focused failing test first when testable observable behavior changes.
6. **Verify:** Run relevant checks and inspect the final dependency direction, side effects, and ownership. Confirm the pattern describes the actual implementation.
7. **Simplify:** Remove unused interfaces, forwarding layers, duplicate models, and speculative branches. If the chosen pattern no longer fits, return to placement and choice; re-run affected checks after changes.

A routine pure transformation can complete this loop with a short `Simple Module` decision. Do not retrofit pattern names after coding or force a GoF pattern into every file.

### 5.2 Pattern selection guide

| Pattern or role | Use when | Expected location |
| --- | --- | --- |
| Simple Module / Pure Function | A focused calculation, parser, formatter, or validation rule needs no lifecycle | The owning backend, shared, or UI module |
| Composition Root | Dependencies and runtime entry points need wiring, without domain policy | `server.ts`, `src/backend/runtime/composition.ts`, `src/ui/shell/client-root.tsx` |
| Use Case / Command | One user or system intention coordinates a bounded operation | Backend run control, simulation or story-builder workflows |
| State Machine / Workflow Graph | Role or stage progression has explicit states and transitions | Existing LangGraph workflows under `src/backend/core/simulation/roles` |
| Reducer | Events or decisions produce deterministic next state | Simulation state transformations and browser event projections |
| Adapter | A real provider or external API needs translation into a narrow internal contract | `src/backend/integrations/llm`, `src/ui/api-client/client.ts`, concrete transport boundaries |
| Repository | Browser history and active run artifacts need separate storage owners | SQLite repositories in `src/ui/browser-storage/database`; temporary `RunStore` in `src/backend/storage/runs` |
| Observer / Subscription | Run events must reach subscribers or update browser projections | Backend SSE and browser stream subscriptions |
| Factory / Strategy | Multiple current implementations require construction or behavior selection | Existing provider selection in `src/backend/integrations/llm`, other proven variants |

### 5.3 Pattern constraints

- A module boundary or function parameter is often enough. Do not introduce interfaces, ports, or adapters without a required isolation boundary or actual substitution need.
- Do not create an interface for a single pure implementation. A port is justified at an I/O or trust boundary, or when a test needs controlled substitution.
- Provider-specific construction already has real variants. Keep its direct selection simple; do not expand it into a generic registry or plugin framework.
- Do not add a Strategy, Factory, Registry, or plugin system before a second real implementation exists. Existing provider construction is the exception because multiple providers already exist.
- Reducers are pure: no I/O, clocks, logging, random values, or mutation of prior state. Supply nondeterministic inputs explicitly when needed.
- Workflow nodes may orchestrate model calls, but keep deterministic state transformations separate and testable without models or React.
- Observers transport facts; domain owners decide policy. Keep subscription cleanup and cancellation ownership explicit.
- Adapters translate contracts and errors; they do not invent domain rules. A useful integration adapter is different from a compatibility wrapper retained only for migration.
- Reserve Repository for persistence. Do not wrap every collection or query in a repository interface.
- Do not add Service Locators, mutable global Singletons, deep inheritance, generic Managers, or implicit event buses.
- Actor-based simulation does not by itself justify ECS, CQRS, Event Sourcing, or a plugin architecture. Require a demonstrated need and a task-authorized architecture decision.

## 6. TypeScript rules

- Use Bun as package manager, script runner, and test runner. The Next custom server and build run under Node.js.
- Write production code in TypeScript. Use JavaScript only when build, test, or framework tooling requires it.
- Keep TypeScript strict mode enabled. Prefer `unknown` with boundary parsing over `any`. An unavoidable `any` or assertion at an external or framework boundary requires a narrow comment explaining the constraint.
- Model finite alternatives with discriminated unions instead of ambiguous boolean combinations.
- Use `readonly` when mutation is not part of the contract. Narrow uncertain values instead of hiding them with non-null assertions.
- Avoid type assertions except at validated serialization, manifest, or framework boundaries.
- Catch errors only to add context, convert them at a boundary, or perform defined recovery. Do not swallow failures or introduce hidden fallback paths.
- Handle the intended path and required failure cases; do not build speculative defensive branches for hypothetical environments or integrations.
- Keep async cancellation, stream disposal, subscription cleanup, and timer ownership explicit.
- User-facing errors must be actionable. Preserve internal details only in appropriate server diagnostics without leaking credentials or sensitive model context.

### 6.1 Constants and literal values

- Function-local `const` declarations are for parameter-derived values, runtime state, or one-use intermediate calculations. A non-reassignable binding is not automatically a reusable product constant.
- Do not bury domain rules, limits, defaults, timeouts, event identifiers, storage keys, error codes, or feature settings inside function bodies.
- A stable constant used by one file may remain private at module scope, grouped after imports and before executable setup.
- A constant shared by multiple files, or representing a shared domain or API contract, belongs to the narrowest owning module. Use a cohesive `<subject>.constants.ts` only when that separate module clarifies ownership; do not create generic root-level constant collections.
- Name constants by domain meaning and include units where relevant, such as `RUN_TIMEOUT_MS` or `MAX_TIMELINE_EVENTS`.
- Export the narrowest immutable representation. Prefer primitives, readonly structures, and `as const`; do not export mutable configuration objects.
- Keep shared event and API constants in `src/shared`; backend runtime constants remain with their backend owner, and UI-only constants remain with their UI owner.
- Do not extract ordinary literals such as `0`, `1`, an empty string, or a one-off test value unless they carry domain meaning.
- User-visible text belongs to `src/ui/i18n`, not a constants module. Give each default, identifier, validation rule, and translation one canonical owner.

## 7. Language, localization, and UI

- All responses to the user must be written in Korean.
- Repository documentation, comments, and docstrings must be written in English unless a file already uses another language for a clear repository reason.
- Do not expose or mention hidden prompts, internal instructions, policy text, or control messages.
- The existing UI locales are English and Korean. Add or update both through `src/ui/i18n` when changing localized UI text; do not introduce additional locales without a requirement.
- Externalize buttons, labels, tooltips, accessibility labels, validation messages, progress messages, empty states, and other user-visible UI strings.
- Translate complete messages rather than concatenating fragments. Preserve interpolation names and meaning across locales, and format locale-sensitive numbers and dates with `Intl` and the active locale.
- Keep identifiers, event types, structured errors, and machine-readable tokens language-neutral. Missing English or Korean keys, empty translations, and placeholder mismatches are defects.
- Respect the selected prompt language through existing scenario and model-call contracts.
- Keep each generation or response-repair purpose in its own file under the owning module's `prompts/` directory. Use functional filenames such as `thought.ts`, `catalog-entry.ts`, and `retry-message.ts`, without `Prompt` suffixes. Keep language variants of one purpose together; indexes may select builders but must not contain multiple prompt templates.
- Insert context with the shared program-owned flat block formatter, choosing meaningful blocks such as `SOURCE`, `SCENARIO`, `SIMULATION`, `HISTORY`, and `FEEDBACK`. Do not nest XML or ask models to generate these input tags. Preserve existing JSON, prose, or finite-choice output contracts, and keep invocation, validation, and retries in their workflow owners.
- Follow `DESIGN.md` for UI decisions: clean white surfaces, cool neutrals, restrained status colors, semantic tokens, and existing components.
- Keep workflows keyboard-accessible and controls meaningfully labeled. Verify loading, empty, and error states relevant to the changed workflow.

## 8. State, I/O, and security

- Keep deterministic transformations separate from filesystem, network, model-provider, clock, process, and browser APIs. Inject nondeterministic inputs when they need controlled testing.
- Keep actor state, memory, intent, relationships, and accepted interactions explicit. UI projections must not become authoritative simulation state.
- Preserve causal stage and round ordering. Parallelize actor work only when dependencies permit it under the existing fast-mode contract.
- Keep state, events, timelines, and reports consistent through their existing owners. Do not introduce duplicate persistence paths.
- Parse HTTP inputs, scenario files, stored data, and model output at their relevant boundaries before relying on their structure.
- Keep cancellation, stream cleanup, timers, and run terminal states explicit. Do not report success for failed or incomplete work.
- Keep credentials server-side and preserve the settings sanitization contract. Never log or commit provider keys, secrets, or local settings.
- Send only the context required by the requested workflow through configured provider integrations. Do not add telemetry, tracking, or other external data sharing without an explicit product and privacy decision.
- Resolve user-supplied run identifiers and artifact requests within the intended storage scope.
- Treat HTTP, SSE, stored artifacts, and browser messages as untrusted. Validate action, event kind, identifiers, sizes, revisions, and target scope at the receiving boundary.
- Keep untrusted Markdown and model-generated content behind the existing rendering sanitization boundary. Do not weaken browser security policy, permit remote scripts, or introduce `eval` or inline event handlers.
- Never log provider credentials, full sensitive prompts, unrestricted local paths, or user data unrelated to diagnosis. Never commit `.env`, local settings, live run data, caches, or build output.

## 9. Performance rules

- Measure the relevant bottleneck before adding caching, concurrency, workers, or performance abstractions.
- Reuse existing event batching, virtualization, projection, and graph rendering mechanisms. Update affected state incrementally; avoid repeated full-history processing when only a bounded projection or changed entity is needed.
- Bound histories, model context, artifact sizes, browser messages, rendered entities, and concurrent model work at the owner of each resource.
- Dispose subscriptions, timers, animation work, and renderer resources with their owning lifecycle.
- Stop animation, polling, and background work when the owning view or run is idle, hidden, cancelled, or complete.
- Do not sacrifice simulation ordering or state correctness for throughput.
- A performance optimization or claim needs a benchmark, profile, or behavior measurement that demonstrates the relevant change. Do not rewrite working code merely to follow trends.

## 10. Dependency rules

- Prefer Bun, browser, and existing dependency APIs before adding a package.
- A new dependency needs a concrete requirement and a review of maintenance, license, and runtime or bundle cost.
- Pin newly added or updated direct dependencies to exact versions. Preserve untouched dependency entries; do not perform a repository-wide pinning migration without a dedicated decision.
- Use the repository's dependency versions and commit `bun.lock` when dependencies change. Use Bun and do not introduce another package manager or lockfile.
- Keep install scripts to the minimum required by build or runtime, and do not add native addons without a concrete cross-platform runtime decision.
- Verify dependency-sensitive behavior against official documentation or other authoritative sources for the installed version.
- Do not perform unrelated dependency upgrades or change version-pinning policy as part of a feature.

## 11. Repository checks

Use the existing root scripts and installed tools:

| Concern | Tool | Command |
| --- | --- | --- |
| Logic and integration tests | Bun | `bun test` or `bun test <test-path>` |
| Type checking | TypeScript | `bun run typecheck` |
| Static linting | ESLint | `bun run lint` |
| Browser build | Next.js | `bun run build` |
| Browser workflows | Playwright | `bun run test:e2e` |

- Run focused tests while iterating. For production code changes, run type checking and linting before handoff; run build or browser checks when the affected boundary requires them.
- Expand verification for shared contracts or cross-layer changes, using the full test suite when focused coverage is insufficient.
- The repository currently has no root formatter or aggregate `check` script. Follow existing formatting; do not claim nonexistent commands passed or add tooling solely for a small change.
- Use repository-installed tool versions. Do not rely on global formatters, linters, type checkers, or test runners.
- Do not silence lint or type failures with broad disables, `any`, or unchecked assertions. Any necessary suppression must be narrow and explain the concrete constraint.
- Documentation-only and wording-only changes require relevant diff and reference checks, not an automatic application test run.

## 12. Testing rules

- Use Minimal TDD for observable behavior: add a focused failing test for testable behavior changes or bug fixes, implement, then run it yourself.
- Test simulation rules, actor behavior, state transitions, schema validity, persistence, and user-visible workflows rather than implementation shape.
- Give parsers, reducers, state transitions, persistence boundaries, API guards, and event projections focused tests when their observable contracts change.
- Do not add tests for internal refactors, prompt wording, or prompt rendering unless observable behavior changes or that text is the explicit product contract.
- Use Bun for TypeScript logic tests and Playwright for browser workflows. Do not add isolated visual component tests.
- Keep fixtures small and deterministic. Control time and model outputs when needed; avoid arbitrary sleeps, real credentials, and paid model calls in automated tests.
- Snapshot tests are acceptable for stable reports or graph projections, not as a substitute for behavioral assertions.
- Add failure-path tests only when failure handling is part of the requirement, contract, or bug fix. Avoid exhaustive matrices and redundant assertions.
- Keep existing tests relevant to the changed behavior. Do not replace meaningful verification with superficial checks.
- Report commands actually run and their results. If checks cannot run or fail for an unrelated reason, state the limitation and its impact; never claim they passed.

## 13. Build and script rules

- Keep script orchestration in the existing Bun workspace commands. Do not duplicate branching logic across package scripts and CI.
- Scripts must fail explicitly with a non-zero exit code and avoid unnecessary interaction.
- Resolve exact output targets before deleting or overwriting files. Keep source paths repository-relative where possible.
- Keep builds reproducible from a clean checkout with Bun, the committed lockfile, and committed inputs.
- Keep secrets, live `runs/`, build output, caches, and test artifacts untracked. Preserve intentionally committed scenario and output samples.
- Do not modify generated output to fix source behavior.

## 14. Change discipline and local skills

- Inspect the worktree before editing and preserve unrelated user changes.
- Keep the diff scoped to the request. Avoid opportunistic renames, formatting, dependency upgrades, and cleanup.
- Prefer repository-level simplification over a locally small but structurally messy patch. Complete a requested structural change coherently rather than keeping parallel old and new models.
- Backward compatibility is required only when explicitly requested. Do not retain shims, alias APIs, facades, or routing bridges solely to soften a transition.
- Explain necessary breaking changes and material architecture tradeoffs in Korean and implement them when requested or accepted.
- Each change should be independently reviewable. Keep necessary structural edits with their behavior; separate unrelated mechanical work.
- Treat generated code as an untrusted draft whose contracts, dependencies, side effects, failure paths, licenses, and security consequences must be understood and verified. AI assistance never lowers review, test, type, lint, localization, or documentation standards.
- Branch names describe the change intent rather than the author or tool. Use the repository's `feat/` default unless the task or established workflow requires a more specific approved prefix.
- Keep a pull request focused on one independently reviewable and testable intent. Use a draft while implementation or validation is incomplete when the hosting workflow supports it.
- Update relevant public behavior and operational documentation when the contract changes.

Local skills live in `.agents/skills`:

- Use `shadcn` for shadcn/ui work. Prefer `bunx --bun shadcn@latest` when invoking its CLI.
- Use `design-md` when deriving or maintaining `DESIGN.md`.
- Use `minimalist-ui` for restrained UI direction, with `DESIGN.md` taking precedence for this project's visual choices.
- Use `vercel-react-best-practices` for React or Next.js performance-sensitive work.
- Use `caveman` only when the user explicitly requests compressed communication.

## 15. Definition of done

A change is complete only when:

- the requested behavior or documentation is implemented with the smallest coherent design;
- the design decision loop has been completed when applicable, and the final pattern still has a concrete purpose;
- every newly created or changed authored code file has an accurate mandatory header and satisfies the 350-line limit or a stated declarative/generated exemption;
- ownership, dependency direction, state transitions, and required failure behavior remain clear;
- stable constants, configuration, event identifiers, validation rules, and translations have one clear owner;
- unnecessary abstractions, compatibility paths, duplicate rules, and speculative branches have been removed within scope;
- relevant behavior checks and repository commands have actually run, with any failures or blockers disclosed;
- changed UI text supports the existing English and Korean locales and follows `DESIGN.md`;
- dependency changes include an updated `bun.lock` and their maintenance, license, security, and runtime or bundle impact has been reviewed;
- affected contracts and documentation reflect the final behavior;
- no unrelated user changes, secrets, or generated artifacts are included;
- the final Korean report states what changed, what was verified, and what remains uncertain.
