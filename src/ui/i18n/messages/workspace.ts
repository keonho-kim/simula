/**
 * Purpose: Localize workspace navigation, report reading, and live conversation progress.
 * Pattern: Localization dictionary.
 * Usage: Composed by ui/i18n/dictionary.ts.
 * Related: src/ui/pages/start-screen.tsx, src/ui/components/actors/actor-rail.tsx
 */
const en = {
  workspaceTitle: "Explore what could happen.", workspaceSubtitle: "Bring your materials and a question. Observe possible developments, understand what shaped them, and return to the evidence.",
  simulationsTitle: "Simulations", simulationsDescription: "Prepare independent scenarios, monitor progress, and inspect each result.",
  simulationsReview: "Review scenario", simulationsEmpty: "Confirm a scenario before preparing simulations.", simulationsOverview: "Execution overview", simulationsSelected: "Selected simulation", simulationsAllControls: "All simulations", simulationsTotal: "Total", simulationsActive: "In progress", simulationsAttention: "Needs attention",
  workspaceRecent: "Recent explorations", workspaceRecentEmpty: "Your saved explorations will appear here. Start with your materials or explore an example.",
  workspaceStart: "Start with your materials", workspaceAlternatives: "Other ways to begin", workspaceBack: "Back", workspaceAdvanced: "Advanced execution settings",
  workspaceAnalysis: "Analysis", workspaceRecords: "Records", workspaceExecution: "Execution details", workspaceContents: "Contents", workspaceScope: "Scope and evidence",
  workspaceChapter: "Read chapter", workspaceEvidenceClose: "Close evidence", workspaceMissingPreview: "No scenario is ready to review. Import a scenario or return to a saved draft.",
  workspaceParallel: "Parallel round", workspacePreparing: "Preparing round {round}", workspaceWorking: "Preparing a response", workspacePending: "Applying", workspaceUnapplied: "Not applied",
  workspaceUnsaved: "Unsaved changes", workspaceSaved: "All changes saved",
  workspaceNewMessages: "New messages", workspaceDisconnected: "Live previews disconnected. Confirmed messages will still appear.",
} as const
const ko = {
  workspaceTitle: "어떤 일이 일어날까요?", workspaceSubtitle: "가지고 있는 자료와 궁금한 상황을 가져오세요. 가능한 전개를 관찰하고, 결과를 만든 조건과 근거를 살펴보세요.",
  simulationsTitle: "시뮬레이션", simulationsDescription: "여러 전개를 준비하고 진행 상태를 확인하며, 각 시뮬레이션의 결과를 살펴보세요.",
  simulationsReview: "시나리오 검토", simulationsEmpty: "시나리오를 확정하면 시뮬레이션을 준비할 수 있습니다.", simulationsOverview: "실행 현황", simulationsSelected: "선택한 시뮬레이션", simulationsAllControls: "전체 시뮬레이션 관리", simulationsTotal: "전체", simulationsActive: "진행 중", simulationsAttention: "확인 필요",
  workspaceRecent: "최근 탐색", workspaceRecentEmpty: "저장된 탐색이 여기에 표시됩니다. 자료를 추가하거나 예시로 시작해 보세요.",
  workspaceStart: "내 자료로 시작하기", workspaceAlternatives: "다른 방법으로 시작", workspaceBack: "돌아가기", workspaceAdvanced: "고급 실행 설정",
  workspaceAnalysis: "분석", workspaceRecords: "기록", workspaceExecution: "실행 정보", workspaceContents: "목차", workspaceScope: "분석 범위와 근거",
  workspaceChapter: "장 읽기", workspaceEvidenceClose: "근거 닫기", workspaceMissingPreview: "검토할 시나리오가 없습니다. 시나리오를 불러오거나 저장된 초안으로 돌아가세요.",
  workspaceParallel: "병렬 진행", workspacePreparing: "라운드 {round} 준비 중", workspaceWorking: "발화 준비 중", workspacePending: "반영 중", workspaceUnapplied: "미반영",
  workspaceUnsaved: "저장하지 않은 변경 사항", workspaceSaved: "모든 변경 사항 저장됨",
  workspaceNewMessages: "새 메시지", workspaceDisconnected: "실시간 미리보기 연결이 끊겼습니다. 확정된 메시지는 계속 표시됩니다.",
} as const satisfies Record<keyof typeof en, string>
export const workspaceTexts = { en, ko }
