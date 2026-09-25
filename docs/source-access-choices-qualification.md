# ScenarioBuilder source-audience choice qualification

Date: 2026-09-23. Run `bun scripts/qualify-source-access-choices.ts` with local LM Studio
`ornith-1.5-35b-a3b` loaded. The runner rejects mock mode and automatic model substitution,
uses isolated settings, and writes a new JSON record under ignored `output/qualification/`.
It does not modify saved user settings.

The small synthetic input is [source-access-choices.json](../sample-input-items/source-access-choices.json),
SHA-256 `797e1be4d7c37433c409b5abb80301cc1cf94768df7ae321598290456deb02bf`.
The observed base commit was `996b28188eea13e794ca3c87437a0cfdca4df018` with a dirty worktree.
Ornith Q4_K_M was loaded with context 85,248 and server parallel setting 2; the runner
used application admission 1, Fast Mode off, temperature 0, no reasoning output, a
64-token choice ceiling, 60-second per-call timeout and a 12-call maximum. Server
version was not recorded.

The final live runner passed in about 1.95 seconds with **three real model calls**:
one private fact choice, one public fact choice, and one targeted recheck. The model
selected only the finance participant for the restricted budget and all participants
for the public meeting date. Accepted replay made zero model calls. Rechecking the first
fact kept the second accepted task unchanged. The model returned only short choices;
code assembled and retained the audience objects. These are small-case observations,
not a general speed or accuracy benchmark.

Focused ScenarioBuilder and generation checks passed. This runner exercises the audience
module with accepted input artifacts; it does not execute full document extraction,
scenario generation, world handoff, simulation, report creation or browser UI. Those
remain explicit PoC acceptance work in [System-Adv.md](../System-Adv.md).
