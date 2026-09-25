/**
 * Purpose: Assemble accepted scenario units and block unresolved access or direct restricted disclosures.
 * Pattern: Deterministic assembly.
 * Usage: Called after source access and other scenario artifacts are accepted.
 * Related: src/backend/core/scenario-builder/graph.ts, src/backend/core/scenario-builder/source-access.ts
 */
import type { ScenarioBuildIssue, ScenarioSpecification } from "@/shared/scenario-builder"
import { digestSchema, facetSchema, rulesSchema, situationSchema, specificationSchema, storedParticipantSchema } from "@/shared/scenario-builder-schema"
import { FACETS, RULES } from "./design"
import type { ScenarioBuilderGraphState } from "./state"
import type { BuilderTasks } from "./contracts"
import { readSourceFacts, restrictedFactsInPublicText } from "./source-access"

export async function assembleScenario(tasks: BuilderTasks, state: ScenarioBuilderGraphState): Promise<ScenarioSpecification> {
  const situation = await tasks.read(state.situationRef, situationSchema)
  const participants = await Promise.all(state.participantRefs.map(ref => tasks.read(ref, storedParticipantSchema)))
  const facets = await Promise.all(FACETS.map(facet => tasks.read(`facet-${facet}`, facetSchema)))
  const rules = await Promise.all(RULES.map(rule => tasks.read(`rule-${rule}`, rulesSchema)))
  const digest = await tasks.read(state.digestRef, digestSchema)
  const sourceFacts = await readSourceFacts(tasks, state.digestRef, state.participantRefs, state.sourceAccessRef)
  const issues: ScenarioBuildIssue[] = []
  for (const gap of digest.gaps) issues.push({ scope: "source-coverage", description: gap, blocking: false })
  for (const fact of sourceFacts) if (fact.audience.kind === "unresolved") issues.push({ scope: "source-access",
    description: tasks.request.language === "ko" ? `${fact.id}의 초기 정보 접근자를 확정할 수 없습니다. 정보 접근 규칙을 확인하세요.`
      : `Initial access to ${fact.id} is unresolved. Review the information rule.`, blocking: true })
  for (const leak of restrictedFactsInPublicText(sourceFacts, publicScenarioTexts(situation, facets))) issues.push({ scope: "source-access",
    description: tasks.request.language === "ko" ? `${leak.factId}의 제한된 자료 사실이 공개 시나리오 문장에 포함되어 있습니다.`
      : `Restricted source fact ${leak.factId} appears in public scenario text.`, blocking: true })
  const sourceEvidenceIds = [...new Set([
    ...situation.evidenceIds, ...facets.flatMap(value => value.evidenceIds), ...participants.flatMap(value => value.evidenceIds),
    ...rules.flatMap(value => value.evidenceIds), ...sourceFacts.flatMap(value => value.evidenceIds),
  ])]
  if (!sourceEvidenceIds.length) issues.push({ scope: "evidence", description: "No source evidence supports this draft; review the extraction and retry.", blocking: true })
  const result: ScenarioSpecification = {
    id: state.buildId, version: 1, status: issues.some(issue => issue.blocking) ? "blocked" : "review",
    documentSetId: tasks.request.documentSetId, documentRevision: tasks.request.documentRevision,
    language: tasks.request.language, situation, participants,
    facets: { goals: facets[0], constraints: facets[1], tensions: facets[2] },
    rules: { information: rules[0], actions: rules[1], termination: rules[2], variation: rules[3] },
    sourceFacts, sourceEvidenceIds, issues,
  }
  return specificationSchema.parse(result)
}

export async function scheduleScenarioRepairs(tasks: BuilderTasks, state: ScenarioBuilderGraphState): Promise<boolean> {
  const sourceFacts = await readSourceFacts(tasks, state.digestRef, state.participantRefs, state.sourceAccessRef)
  const situation = await tasks.read(state.situationRef, situationSchema)
  const facets = await Promise.all(FACETS.map(facet => tasks.read(`facet-${facet}`, facetSchema)))
  for (const leak of restrictedFactsInPublicText(sourceFacts, publicScenarioTexts(situation, facets))) {
    tasks.repairs.set(leak.target, `Remove restricted ${leak.factId} from public prose while preserving the shared decision context.`)
  }
  return tasks.repairs.size > 0
}

function publicScenarioTexts(situation: { title: string; purpose: string; decision: string; setting: string },
  facets: readonly { summary: string }[]): Array<{ target: string; text: string }> {
  return [{ target: "situation-title", text: situation.title }, { target: "situation-purpose", text: situation.purpose },
    { target: "situation-decision", text: situation.decision }, { target: "situation-setting", text: situation.setting },
    ...FACETS.map((key, index) => ({ target: `facet-${key}`, text: facets[index]?.summary ?? "" }))]
}
