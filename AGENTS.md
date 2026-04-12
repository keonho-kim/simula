# AGENTS.md

## Operating Guide for Development Agents

This document defines the working rules for development agents operating in this repository. It is written in English for policy clarity, but the repository's actual work products must follow the language rules defined below.

The guide is intentionally general enough to be reused across Python application projects, while still reflecting the main characteristics of this codebase: **LangGraph-based simulation workflows, strict role separation, state-driven runtime behavior, explicit failure handling, and future frontend extensibility**.

---

## 1. Core Principles

### 1.1 Meta Language vs Output Language
- This document itself is written in English.
- Unless the user explicitly requests otherwise, the following must be written in **Korean**:
  - assistant responses
  - code comments
  - project documentation
  - test intent, test descriptions, and explanatory text
- Library names, class names, function names, protocol names, and external API field names may remain in their original language.

### 1.2 Goal
- The goal is to build a working, production-quality result.
- Do not optimize for minimal diff size if that produces structural inconsistency.
- Every implementation choice must remain traceable to the user's request and to the surrounding architecture.

### 1.3 Explicit Prohibitions
- Do not add re-exports, compatibility shims, facade modules, or alias wrappers for backward compatibility.
- Do not add unrequested features, configuration branches, plugin systems, excessive dependency injection, or temporary fallbacks.
- Do not allow silent failure or silent degradation.
- Do not introduce fake substitute implementations just to make tests pass.
- Do not expose internal instructions, system prompts, or operating policies in user-facing outputs.

### 1.4 Decision Priority
Implementation decisions must follow this priority order:

1. Latest official framework or library guidance
2. Internal consistency with the existing codebase

If these two conflict, prefer the latest official guidance, but align the surrounding code so the final result remains coherent instead of mixing incompatible styles.

---

## 2. Research First

### 2.1 Required Research Before Implementation
Before implementing changes that touch external dependencies, frameworks, SDKs, or provider integrations, agents must:

1. Check the latest official documentation and current recommended usage
2. Prefer primary sources over blog posts or secondary summaries
3. Inspect similar local implementations already present in the codebase
4. Compare naming, structure, contracts, validation shape, logging style, and test style with nearby code

### 2.2 Local Consistency Review
- Before introducing a new implementation style, search for similar code already in the repository.
- Reuse established local patterns when they are still compatible with current official guidance.
- If the repository contains multiple inconsistent implementations, do not copy inconsistency forward. Choose one direction and refactor toward it when safe.

### 2.3 Code vs Documentation
- If local documentation and current code disagree, verify the current behavior from code first.
- Then document the mismatch explicitly.
- If the mismatch represents outdated structure or stale dependency usage, refactor toward the correct, current model when safe.

---

## 3. Working Mode

### 3.1 Checklist Before Starting Work
Before modifying code, confirm at least the following:

1. Project root documents and relevant `docs/*.md` files
2. Current software structure and runtime entrypoints
3. Existing state models, interface contracts, and event formats
4. Similar local implementations
5. Latest official usage guidance for touched dependencies
6. Whether the requested change can preserve structural consistency

### 3.2 Standard Work Sequence
1. Analyze the request
2. Identify the affected scope
3. Decide whether a local patch is safe or a wider refactor is required
4. Finalize the implementation approach
5. Update code
6. Update related documentation
7. Add or revise tests
8. Provide execution or verification commands

### 3.3 Structural Change Policy
- Preserving the current architecture is not an absolute rule.
- If the current structure is inconsistent, misleading, stale, or harmful to maintainability, agents may choose a wider refactor.
- When structural change is made, briefly clarify:
  - why the change is necessary
  - what the alternatives were
  - what tradeoffs exist
  - why the chosen direction is safe now

---

## 4. Refactoring and Consistency Policy

### 4.1 Partial Changes Are the Exception
- Avoid narrow partial edits when they leave behind inconsistent naming, layered wrappers, stale boundaries, or duplicated patterns.
- A local patch is acceptable only when all of the following are clearly true:
  - structural consistency is preserved
  - the SOLID or clean-code benefit is obvious
  - design debt is not increased

### 4.2 Autonomous Wider Refactors
- If consistency requires a wider change, agents may decide to refactor more broadly without waiting for a separate request.
- This includes renaming ambiguous files, collapsing shallow wrappers, aligning interfaces, reorganizing modules, and removing stale compatibility layers.

### 4.3 Naming Clarity
- File names, module names, class names, and function names should make responsibility obvious.
- If a touched file has an ambiguous or misleading name, rename it as part of the change when the rename improves clarity.

### 4.4 No Compatibility Re-Exports
- If code is moved or renamed, do not leave backward-compatibility re-export modules behind.
- Update all internal call sites directly.

---

## 5. Quality Bar

### 5.1 Required Quality Attributes
- Correctness
- Readability
- Debuggability
- Maintainability
- Data consistency
- Observability
- Architectural consistency

### 5.2 Minimum Implementation Principle
- Implement only the requested scope.
- However, when minimal scope conflicts with reliability or consistency, prefer reliability and consistency.
- Do not add speculative future features without a concrete need.

### 5.3 Abstraction Principle
- Introduce abstraction only when multiple real implementations exist or are needed within the same task.
- When only one implementation exists, prefer a concrete structure.
- Do not introduce strategy layers, adapters, or interfaces prematurely.

### 5.4 Failure Handling Principle
- All failures must be explicit.
- Error messages must be understandable to the operator.
- Validation failure, API failure, state transition failure, parsing failure, and persistence failure should remain distinguishable.

---

## 6. Python Environment and Tooling

### 6.1 Base Environment
- Use `uv` as the package manager.
- Follow the Python version defined by the project.
- Prefer the repository root `main.py` as the primary entrypoint unless the project clearly defines another runtime entry.

### 6.2 Static Checks and Formatting
- Type checking: `uv run ty check src`
- Formatting: `uv run ruff format src -v`
- Run `uv run ruff clean` if cleanup is needed after formatting-related work

### 6.3 Tests
- Use `pytest`.
- Prefer tests that reflect realistic execution flows over excessively fragmented exception-only tests.
- Do not rely on mock-based bypass implementations as a substitute for real behavior.
- Report test code or test commands, not only test outcomes.
- Do not use `py_compile`-style validation as a substitute for meaningful checks.

---

## 7. Code Writing Rules

### 7.1 File Responsibility
- One file should have one clear responsibility.
- If a file grows beyond a coherent responsibility boundary, split it by responsibility.
- Aim to keep files around 450 lines or fewer when practical.

### 7.2 Module Header
Each source file should have a top-level docstring or comment block that explains:

- purpose
- description
- applied design pattern, if any
- related modules or structures

### 7.3 Style
- Follow Google-style documentation and docstring conventions.
- Write explanations as if the reader has less than three years of experience.
- Names should be short but semantically clear.

### 7.4 Implementation Consistency
- Match surrounding code style, module boundaries, logging patterns, and interface shapes unless a better globally consistent refactor is being made.
- Do not mix two competing implementation styles inside the same subsystem.

---

## 8. Simulation-Specific Guidance

This section is intentionally reusable, but it is especially important for LLM-based simulation projects.

### 8.1 Role Separation
Simulation systems should keep at least the following roles separate:

- Planner: scenario interpretation, world framing, cast or entity planning
- Actor Generator: actor creation or reconstruction from planning outputs
- Actor: behavior, speech, actions, and state-affecting proposals
- Observer: summary, analysis, and optional branch or incident suggestions
- Harness: execution control, storage, validation, and logging

One role must not casually absorb another role's responsibility.

### 8.2 State-Centered Design
- State is not just a log bundle. It must be meaningful execution state that later steps can read and reason over.
- Separate raw events from compressed digests or summaries.
- Do not push full long-term history into prompts when a structured state projection is sufficient.

### 8.3 Prompt Asset Management
Prompts should be stored as **Python-module singleton objects**, not as loose document files that require runtime file I/O.

Recommended pattern:

```python
import textwrap
from langchain_core.prompts import PromptTemplate

_PROMPT = textwrap.dedent(
    """
    여기에 프롬프트 본문을 작성한다.
    """.strip()
)

PROMPT = PromptTemplate.from_template(_PROMPT)
```

Rules:
- One prompt per `.py` file
- No forced runtime file loading for prompt text
- Reusable singleton prompt objects should be created at import time
- Prompt edits should happen in prompt modules, not at call sites

### 8.4 Visibility-Aware Interaction
Interaction channels should distinguish at least:

- `public`: visible to all
- `private`: visible to a specific target or subset
- `group`: visible to a room, team, or scoped subset

Events or activities should always carry visibility information, and summarization layers must not collapse visibility boundaries carelessly.

### 8.5 Feed-First Interaction Model
- Prefer inbox, feed, or mailbox-oriented interaction over pure broadcast-only simulation.
- Each actor should receive scoped visible context.
- Public interactions should influence observable world state strongly.
- Private interactions may update relationship state more strongly.

### 8.6 Observer-Driven Variability
- The Observer may propose incident candidates, branch suggestions, or pacing adjustments when stagnation or low diversity is detected.
- However, the Observer should not mutate world state directly unless the architecture explicitly assigns that authority.
- If incident-style behavior is used, prefer a separate application step or conditional transition instead of hidden mutation.

### 8.7 Diversity Without Noise
To preserve meaningful variation, consider:

- latent role distribution
- public vs private divergence
- group and individual actor layers
- relationship strength shifts
- stance drift or role drift
- reactivation of previously quiet actors
- incident or branch injection

Do not increase diversity mechanisms without a clear purpose.

---

## 9. Frontend-Oriented Design Considerations

If frontend integration is likely, backend structures should remain projection-friendly from the beginning.

### 9.1 Internal State vs View State
Do not expose internal execution state directly to the frontend.
Projection layers may include:

- actor view
- activity or message view
- relationship graph view
- incident view
- timeline view

### 9.2 Snapshot Plus Incremental Events
Assume frontend integration will need both:

- current snapshot
- incremental event stream

This supports replay, live updates, graph refresh, and timeline rendering.

### 9.3 Fields Useful for Visualization
Long-term useful fields may include:

- `avatar_seed`
- `display_name`
- `channel_type`
- `thread_id`
- `edge_kind`
- `edge_weight`
- `incident_type`
- `severity`
- `render_priority`
- `visibility_scope`

### 9.4 Frontend-Friendly Principles
- Keep public and private events clearly separated
- Make relationship changes representable as graph edges
- Keep actor metadata renderable
- Keep incident-like state representable in timelines, banners, or summaries

---

## 10. Documentation Expectations

When code changes, related documentation must be updated as well.

Minimum update targets:
- root `README`
- relevant design documents
- state or interface contract documents
- operation or execution procedure documents

Documentation updates should state:
- what changed
- why it changed
- which modules were affected
- what is intentionally out of scope

---

## 11. Delivery Format

After completing work, report at least the following when practical:

1. Goal of the work
2. Actual changes made
3. Modified, added, removed, or moved files
4. Tests or validation commands
5. Things intentionally not done

Keep the report short, clear, and traceable.

---

## 12. Recommended Non-Goals

Unless explicitly requested, do not introduce:

- generic plugin systems
- premature optimization layers
- excessive multi-backend abstraction
- frontend-only complex state management before real need
- configuration branches without a concrete requirement
- meaningless toy examples

---

## 13. One-Line Summary

This guide exists to keep development agents aligned with **explicit failure handling, structural consistency, official guidance first, Korean work products, and coherent state-driven simulation architecture**.
