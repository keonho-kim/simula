/**
 * Purpose: Localize Multiverse configuration, world progress, and server-owned controls.
 * Pattern: Localization dictionary.
 * Usage: Merged into the English and Korean application dictionaries.
 * Related: src/ui/components/multiverse/multiverse-panel.tsx
 */
const en = {
  batchTitle: "Multiverse", batchDescription: "Run independent worlds from this confirmed scenario. Each world develops its own story and decisions.",
  batchWorldCount: "Number of worlds", batchWorldCountHelp: "Choose 1–{maximum} worlds. All worlds share the confirmed scenario; model capacity controls request queueing.",
  batchDuration: "Execution time limit · minutes", batchDurationHelp: "The limit includes preparation and approval waits. Unfinished worlds stop when the budget expires.",
  batchStart: "Start worlds", batchCancel: "Stop all unfinished worlds", batchResume: "Retry unfinished preparation", batchNew: "New batch",
  batchSelect: "Select a world", batchWorld: "World {index}", batchRound: "Round {index} completed", batchSummary: "{completed} of {total} worlds completed · {failed} failed · {canceled} canceled · {interrupted} interrupted",
  batchPending: "Waiting to start", batchPreparing: "Developing story", batchRunning: "Simulating", batchWaiting: "Waiting for next round",
  batchCompleted: "Complete", batchFailed: "Failed", batchCanceled: "Canceled", batchInterrupted: "Interrupted", batchPartial: "Partially complete",
  batchCancelWorld: "Stop this world", batchContinue: "Continue this world", batchOpenWorld: "Open simulation", batchOpenResult: "Open this world's result",
  batchAutomaticHelp: "Progression runs on the server even when this page is closed. The first three automatic approvals wait five seconds.",
  batchCountdown: "The server will continue this world after its countdown.", batchDeadline: "The execution time limit was reached. Completed worlds are preserved.",
  batchInterruptedHelp: "Accepted preparation can be resumed. Interrupted simulation histories are preserved; mid-round recovery is not available yet.",
  batchManagedNotice: "This world's round controls are in its Multiverse list.",
} as const
const ko = {
  batchTitle: "Multiverse", batchDescription: "확정한 시나리오에서 독립된 세계들을 실행합니다. 각 세계는 스토리와 의사결정을 따로 구성합니다.",
  batchWorldCount: "세계 수", batchWorldCountHelp: "1~{maximum}개를 선택합니다. 확정한 시나리오는 공유하며, 모델 호출 한도에 따라 요청이 대기할 수 있습니다.",
  batchDuration: "실행 시간 한도 · 분", batchDurationHelp: "준비와 라운드 승인 대기 시간이 포함됩니다. 한도에 도달하면 진행 중인 세계를 중단합니다.",
  batchStart: "세계 실행", batchCancel: "진행 중인 세계 모두 중단", batchResume: "미완료 준비 다시 시도", batchNew: "새 묶음 실행",
  batchSelect: "세계 선택", batchWorld: "세계 {index}", batchRound: "라운드 {index} 완료", batchSummary: "전체 {total}개 중 {completed}개 완료 · {failed}개 실패 · {canceled}개 취소 · {interrupted}개 중단",
  batchPending: "시작 대기", batchPreparing: "스토리 구체화", batchRunning: "시뮬레이션 중", batchWaiting: "다음 라운드 대기",
  batchCompleted: "완료", batchFailed: "실패", batchCanceled: "취소됨", batchInterrupted: "중단됨", batchPartial: "일부 완료",
  batchCancelWorld: "이 세계 중단", batchContinue: "이 세계 진행", batchOpenWorld: "시뮬레이션 열기", batchOpenResult: "이 세계 결과 보기",
  batchAutomaticHelp: "화면을 닫아도 서버에서 진행합니다. 첫 세 번의 자동 승인은 5초간 기다립니다.",
  batchCountdown: "서버에서 대기 시간이 끝나면 이 세계를 계속 진행합니다.", batchDeadline: "실행 시간 한도에 도달했습니다. 완료된 세계의 결과는 보존됩니다.",
  batchInterruptedHelp: "완료된 준비 작업을 재사용해 다시 시도할 수 있습니다. 중단된 시뮬레이션 기록은 보존되며, 라운드 중간 복구는 아직 지원하지 않습니다.",
  batchManagedNotice: "이 세계의 라운드 진행은 Multiverse 목록에서 조정합니다.",
} as const satisfies Record<keyof typeof en, string>
export const multiverseTexts = { en, ko } as const
