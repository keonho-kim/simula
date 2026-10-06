# Prompt quality review — 2026-10-02

## Goal and boundaries

Improve the usefulness of generated content and autonomous continuation decisions for small models. Keep the existing finite-choice parsers, retry limits, output lengths, visibility boundaries, and ordered simulation execution. This review does not establish accuracy on a real model: validation uses deterministic model doubles and the repository's fixed model.

## Review by responsibility

| Family | Finding and action |
| --- | --- |
| Shared language and input blocks | Keep the existing bilingual output guide, untrusted-data boundaries, and unchanged machine choices. Do not attach a long generic quality manifesto to every request. |
| Scenario source review and preparation | Source claim/gap prompts already preserve conditions, unknowns, and access limits. Preserve them. Shared prose guidance now favors concrete evidence and conditions over filler without relaxing the existing input cap. |
| Scenario participant/rule generation | Preserve explicit authority, observable behavior, open decisions, completion conditions, and source-versus-assumption boundaries. These already prohibit invented approval powers and predetermined outcomes. |
| World openings | Preserve public/private knowledge routing and fixed identities. Opening variations must remain within confirmed scenario permissions. Shared task guidance also applies here. |
| Planner | Make the decision, constraints, plausible triggers, distinct event pressures, and observable end condition explicit. Avoid repeated crises, invented resources, and forced consensus. Planned events remain possibilities until injected. |
| Actor cards | Express observable behavior under pressure, a role-specific preference, and a plausible tradeoff. Avoid personality stereotypes, uniform harmony, and unsupported secret agendas. |
| Actor decisions and dialogue | Ask the thought step to address the latest visible change. Give spoken-message generation the existing bounded actor-visible history directly; previously it only received thought/intent summaries. Respond to the actual request without inventing another person's acceptance or completed work. Solitary action and no-action paths retain their contracts. |
| Coordinator event handling | Inject events when their conditions fit; do not choose the first entry or reinject just to fill rounds. Resolve an event from its own required decision/result, distinguishing promises from performance. |
| Autonomous continuation | Use the selected language for the decision rubric and examples. Require both changed evidence and a feasible remaining response/action. A first actionable proposal can warrant a reply; unresolved labels and repetition cannot. A completed end condition overrides an otherwise meaningful final change. |
| Memory | Keep exact-quote extraction and explicit closure rules. Compression now preserves attribution, negation, conditions, unresolved questions, and proposal/commitment/execution distinctions. |
| Observer | Lead with changed or unresolved results. Ground actor reactions in recorded interactions; acknowledge no material change instead of inventing movement. |
| Analytical reports | Existing section instructions already separate source evidence, observations, interpretations, and uncertainty. Strengthen final prose to answer first, explain mechanisms and counterevidence, and avoid repeating findings to fill paragraphs. Keep sparse-evidence and incomplete-coverage warnings. |

## Autonomous decision contract

The model still returns exactly `1` or `0` after each actor round. The application does not make additional model calls or interpret free-form reasoning. Fixed-round mode does not call this decision. Invalid responses still pass through bounded repair and fail explicitly after exhaustion.

| Recorded comparison | Desired judgment |
| --- | --- |
| First actionable proposal awaits an existing recipient's response | Continue |
| Agreement creates a required verification task for a named actor | Continue |
| New refusal rules out one option; a feasible alternative remains | Continue |
| Same proposal or position repeats with no changed information | Stop |
| An event remains partial but no meaningful next action exists | Stop |
| Required decision is settled and no required follow-up remains | Stop |

These are prompt examples and intended labels, not measured model predictions. A later real-model evaluation should test paraphrases, long histories, contradictory records, both languages, and several small model families. Measure false continuation and premature stopping separately.

## Validation and cost

- Coordinator workflow tests cover fixed mode, autonomous continuation and stopping, repeated event injection, invalid-answer retries, and immutable previous/current snapshots.
- The dialogue test checks that a latest visible question survives a long earlier memory, excludes a peer's private concern, and stays within the fixture's bounded context size.
- Input-block injection tests include the newly supplied HISTORY block. Role and world visibility tests remain in the full suite.
- The report context regression retains its existing 15,000-character fixture bound; shared guidance was shortened after the first attempt exceeded it.
- No output schema, persisted event contract, retry count, or model-call count changes. Dialogue input grows by its already-bounded visible-history projection. Model latency and semantic accuracy remain unmeasured without a live provider.
