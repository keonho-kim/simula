/**
 * Purpose: Localize navigation through builder stages, targets, and individual generation steps.
 * Pattern: Localization dictionary.
 * Usage: Merged by src/ui/i18n/dictionary.ts for both supported locales.
 * Related: src/ui/components/scenario-builder/builder-activity.tsx, src/ui/models/scenario-builder/preparation-groups.ts
 */
const en = {
  builderGenerationStages: "Generation stages", builderGenerationPath: "Generation path",
  builderTargets: "Generation targets", builderSteps: "Steps",
  builderSelectTarget: "Select a target to inspect its steps.",
  builderSelectStep: "Select a step to view its live content or accepted result.",
  builderBackToTargets: "Back to targets", builderBackToSteps: "Back to steps",
  builderStepProgress: "{completed} of {total} received steps complete",
  builderReceivedComplete: "Received steps complete",
  builderStepCoverage: "More steps may appear as generation progresses.",
  builderTargetsPending: "Targets will appear when this stage begins.",
  builderStepLoading: "Loading step content…", builderStepPending: "Content will appear as this step progresses.",
  builderStepLoadFailed: "This step could not be loaded. Please try again.",
  builderStepStructuredResult: "This step is complete. Its choice is included in the scenario review.",
  builderSituationTarget: "Decision context", builderSourceSynthesis: "Combined materials",
  builderCastCountStep: "Choose participant count", builderCastNameStep: "Select participant {index} name",
  builderSourceClaimStep: "Evidence group {group}: check fact {index}",
  builderSourceSummaryStep: "Evidence group {group}: summary", builderSourceGapStep: "Evidence group {group}: missing information",
  builderDigestSelectStep: "Synthesis level {level}, group {group}: select evidence",
  builderDigestSummaryStep: "Synthesis level {level}, group {group}: summary",
  builderSourceAccessStep: "Source fact {index}: access",
  builderStartingPosition: "Starting position", builderImmediateConcern: "Immediate concern", builderAgenda: "Agenda",
} as const
const ko = {
  builderGenerationStages: "생성 단계", builderGenerationPath: "생성 경로",
  builderTargets: "생성 대상", builderSteps: "세부 단계",
  builderSelectTarget: "생성 대상을 선택하면 세부 단계를 볼 수 있습니다.",
  builderSelectStep: "세부 단계를 선택하면 작성 중인 내용과 확정된 결과를 볼 수 있습니다.",
  builderBackToTargets: "생성 대상 목록", builderBackToSteps: "세부 단계 목록",
  builderStepProgress: "확인된 {total}단계 중 {completed}단계 완료",
  builderReceivedComplete: "확인된 단계 완료",
  builderStepCoverage: "진행 중에는 새 세부 단계가 추가될 수 있습니다.",
  builderTargetsPending: "이 단계가 시작되면 생성 대상이 표시됩니다.",
  builderStepLoading: "단계 내용을 불러오는 중…", builderStepPending: "이 단계가 진행되면 내용이 표시됩니다.",
  builderStepLoadFailed: "이 단계를 불러오지 못했습니다. 다시 시도하세요.",
  builderStepStructuredResult: "완료된 단계입니다. 선택 결과는 시나리오 검토에 반영됩니다.",
  builderSituationTarget: "기본 상황", builderSourceSynthesis: "자료 종합",
  builderCastCountStep: "등장 인원 결정", builderCastNameStep: "인물 {index} 이름 선정",
  builderSourceClaimStep: "근거 묶음 {group} · 사실 {index} 확인",
  builderSourceSummaryStep: "근거 묶음 {group} · 요약", builderSourceGapStep: "근거 묶음 {group} · 확인할 정보",
  builderDigestSelectStep: "{level}차 종합 {group} · 핵심 근거 선택",
  builderDigestSummaryStep: "{level}차 종합 {group} · 요약",
  builderSourceAccessStep: "자료의 사실 {index} · 접근 범위",
  builderStartingPosition: "시작 입장", builderImmediateConcern: "당면 우려", builderAgenda: "진행안",
} as const satisfies Record<keyof typeof en, string>
export const builderGenerationTexts = { en, ko }
