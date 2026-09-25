# Planner event-audience Ornith qualification

Date: 2026-09-24. Run `bun scripts/qualify-event-audience.ts` with local LM Studio
`ornith-1.5-35b-a3b` already loaded. The runner refuses mock mode or model substitution,
uses isolated settings and temporary canonical RunStore storage, and writes a new JSON
record under ignored `output/qualification/`. An optional first argument selects a new
result path. It does not change saved provider settings.

## Recorded configuration

- Fixture: [event-audience.json](../sample-input-items/event-audience.json), three synthetic Korean recipients.
- Fixture SHA-256: `7f39e273f36b122c5876b4f71afada357eff7b54ee8c631663c2ca051691acc8`.
- Base commit: `996b28188eea13e794ca3c87437a0cfdca4df018`; dirty worktree: true.
- Model: Ornith Q4_K_M; context 85,248; provider parallelism 2.
- Application admission 1; Fast Mode on for sibling isolation, off for targeted retry.
- Planner ceiling 128 tokens, temperature 0, reasoning effort none, per-call timeout 60 seconds.
- Runner maximum 20 admitted calls and 10-minute deadline. Server version not recorded.

## Result and scope

The current **indexed-choice** live run passed with seven actual requests in about
4.37 seconds (`output/qualification/event-audience-1790180333312.json`). Public,
private and group events were accepted on their first attempt. The intentionally
ambiguous event returned unresolved on all three attempts, so code marked that event
missed with no recipients and did not inject it. Correcting its wording required one
additional call for that event alone. The model returns `0`, `?`, or comma-separated
roster numbers; code stores explicit actor IDs. These are small-fixture observations,
not a throughput or semantic-quality benchmark.

Verified assertions:

- Public announcement reaches all three actors.
- Personal incoming notice reaches only its recipient.
- Private conversation reaches its two participants, excluding the third person mentioned.
- Accepted siblings survive an unresolved event and actual storage reopening.
- Injected private events retain their audience and hide details from outsiders.
- Reusing accepted audiences makes zero new calls.
- Foreign IDs in persisted audiences fail before inference.
- Correcting an unresolved event processes and persists only that event.

Pure parsing tests also cover unresolved/empty/duplicate/foreign selections and an
invalid roster. Typecheck, lint and backend/web
build are checked separately; historical mock browser results are not live evidence.

## Remaining limits

The root graph wires assignment after Generator and before Coordinator. This runner
exercises that module with a prepared roster, not the entire root graph, role generation,
actor decisions or browser UI. A separate live browser run covers the single-world
flow. This runner verifies stored-state reuse through the module API; it does not
provide a user-facing retry endpoint or durable mid-run graph resume.

Existing explicitly assigned audiences are trusted after roster validation. Changing a
plan or roster requires a new assignment; callers must not attach old grants to revised
events. The classifier consumes confirmed information rules and source grants, but this
fixture does not establish semantic confidentiality for arbitrary paraphrases or contradictory
source rules. Upstream public-prose provenance needs separate review.

Each new event adds one bounded model request, with at most three output-completion
attempts. Fast Mode permits independent siblings through the existing admission owner;
acceptance writes are serialized. An unresolved audience makes that event missed with
no recipients; it never silently broadens an event to public.
