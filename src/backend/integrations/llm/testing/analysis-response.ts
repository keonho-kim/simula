/**
 * Purpose: Provide deterministic analytical report responses for the explicit local test model.
 * Pattern: Test-only provider fixture.
 * Usage: Called only by model-factory's SIMULA_TEST_MODEL path.
 * Related: src/backend/integrations/llm/model-factory.ts
 */
export function testAnalyticalReportResponse(prompt: string): string | undefined {
  const id = prompt.match(/Task ID: (.+)/)?.[1] ?? ""
  if (!prompt.includes("Analytical report") && !/^(scenario-context-|document-|material-summary|world-|worlds-summary|perspective-|trajectory-|strengths-|weaknesses-|opportunities-|threats-|trajectories-|actors-|materials-|scenario-|conclusion-)/.test(id)) return undefined
  const korean = prompt.includes("Write Korean prose")
  const summary = korean ? "주어진 조건과 근거가 의사결정의 범위를 제한합니다." : "The supplied conditions and evidence constrain the decision."
  if (prompt.includes("Allowed answer: one concise evidence summary")) return summary
  const perspectiveFields: Record<string, string> = {
    "perspective-focus": korean ? "검토 의사결정" : "Review decision",
    "perspective-objective": summary,
    "perspective-horizon": korean ? "이번 시나리오의 검토 기간" : "This scenario's review period",
    "perspective-boundary": korean ? "내부 의사결정과 외부 조건을 구분합니다." : "Distinguish internal decisions from external conditions.",
  }
  if (id.startsWith("perspective-")) return perspectiveFields[id]
  if (id.startsWith("conclusion-") && id.endsWith("-summary")) return summary
  if (id.startsWith("conclusion-") && id.endsWith("-content")) return korean
    ? "자료에 기재된 조건과 시뮬레이션 관찰의 범위를 구분합니다. 추가 근거가 필요한 부분은 아직 확인되지 않았습니다. 실제 의사결정에는 별도 검증이 필요합니다."
    : "The recorded conditions and simulated observations have distinct scopes. Missing evidence remains unverified. Real-world decisions require additional checks."
  if (id.endsWith("-score")) return "2"
  if (id.startsWith("trajectory-world-")) return "1"
  if ((id.startsWith("trajectory-proposal-") || id.startsWith("trajectory-vocabulary-")) && id.endsWith("-count")) return "1"
  if ((id.startsWith("trajectory-proposal-") || id.startsWith("trajectory-vocabulary-")) && /-label-\d+$/.test(id))
    return korean ? "근거 검토 후 조건부 판단" : "Evidence review followed by a conditional decision"
  if ((id.startsWith("trajectory-proposal-") || id.startsWith("trajectory-vocabulary-")) && /-description-\d+$/.test(id)) return summary
  if (id.endsWith("-detail")) return korean
    ? "시나리오의 조건과 인물의 판단을 연결해 검토했습니다.\n\n관측된 내용은 이 시뮬레이션의 기록이며 실제 발생 확률을 뜻하지 않습니다.\n\n추가 자료와 다른 조건에서의 검증이 필요합니다."
    : "The scenario's constraints frame the recorded decisions.\n\nThese observations describe this simulation and do not establish real-world probabilities.\n\nFurther evidence and alternative conditions remain necessary."
  if (id.endsWith("-findings-summary")) return summary
  if (id.endsWith("-finding-count")) return "1"
  if (/-finding-\d+-source$/.test(id)) return "1"
  if (/-finding-\d+-text$/.test(id)) return korean ? "기록된 판단에는 추가 근거가 필요합니다." : "The recorded decision needs supporting evidence."
  if (id.endsWith("-finding-gap")) return korean ? "실제 결과는 확인되지 않았습니다." : "Real-world outcomes are unverified."
  return summary
}
