# World source-access Ornith qualification

Date: 2026-09-24. Run `bun scripts/qualify-world-access.ts` from the repository root.
The runner requires loaded local LM Studio `ornith-1.5-35b-a3b`; it never substitutes a
model or overwrites saved provider settings. New JSON results go to ignored
`output/qualification/`; an optional first argument selects a new result path.

## Configuration and evidence

- Synthetic input: [world-access.json](../sample-input-items/world-access.json).
- Input SHA-256: `dee921a18e95c2c2ca5ca743ea8790201419c5c7499e5ac20852775f18e75e02`.
- Base commit: `996b28188eea13e794ca3c87437a0cfdca4df018`; dirty worktree: `true`.
- Ornith Q4_K_M, loaded context 85,248, provider parallel setting 2.
- Application concurrency 1, fast mode off, temperature 0, reasoning effort none.
- Public position/private concern ceilings: 384 tokens each; agenda/information
  are short text tasks. Per-call timeout 60 seconds; runner deadline 10 minutes,
  50-call maximum.
- Server version not recorded. This is module qualification, not a deployment release.

Before the fix, the runner failed after two actual calls because the public
`actor-participant-2` request contained the restricted source marker. The former request
produced both a public position and a private concern from the same private input.

After separating public and private generation inputs and removing routine model
re-review, the latest runner passed: **7 requests, no repair attempts**, about
9.57 seconds (`output/qualification/world-access-1790174030561.json`). This is
not a latency benchmark or a semantic-quality rate.

## Verified behavior

- Only the entitled participant's private-concern request contains the restricted marker.
- Opening, agenda, information flow, public positions and the other participant's
  private concern do not receive that marker.
- Actor initial knowledge includes exactly the confirmed source grants.
- A recipient acquires the secret only after the accepted disclosure; original actors
  remain unchanged.
- Replaying accepted tasks does not invoke the model again.
- Altering a world's source grants is rejected at simulation handoff.
- Canonical run storage and reopening preserve the granted facts.
- Deterministic checks reject unknown/unresolved audiences, direct private text (including quotes),
  and restricted-only evidence in public premises.

Typecheck, lint and backend/web build passed. Two pure access-policy tests passed.
The real-model test covers world preparation; actor handoff, disclosure and storage are
deterministic checks on its actual output. Planner and simulation model execution, browser
flows and VDI behavior were not tested by this runner.

## Scope and remaining requirements

Public/private separation keeps the two generation units per participant bounded and
separately repairable. Public generation never receives the private SOURCE input.
The runner does not establish confidentiality for arbitrary paraphrases in an upstream
confirmed public premise; deterministic exact-text/citation checks remain narrower
than that semantic property. Planner audiences and the complete browser journey have
separate qualification evidence.
