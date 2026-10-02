/**
 * Purpose: Localize Multiverse configuration, simulation progress, and server-owned controls.
 * Pattern: Localization dictionary.
 * Usage: Merged into the English and Korean application dictionaries.
 * Related: src/ui/components/multiverse/multiverse-panel.tsx
 */
const en = {
  batchTitle: "Multiverse", batchDescription: "Run independent simulations from this confirmed scenario. Each simulation develops its own story and decisions.",
  batchSetupHelp: "Run several simulations from one shared scenario. Each simulation develops its own interactions; concurrent model calls follow the settings limit.",
  batchWorldCount: "Number of simulations", batchWorldCountHelp: "Choose 1–{maximum} simulations. All simulations share the confirmed scenario; model capacity controls request queueing.",
  batchDuration: "Execution time limit · minutes", batchDurationHelp: "The limit includes preparation and approval waits. Unfinished simulations stop when the budget expires.",
  batchStart: "Start simulations", batchCancel: "Stop unfinished simulations", batchResume: "Retry unfinished preparation", batchNew: "New simulations",
  batchSelect: "Select a simulation", batchWorld: "Simulation {index}", batchRound: "Round {index} completed", batchSummary: "{completed} of {total} simulations completed · {failed} failed · {canceled} canceled · {interrupted} interrupted",
  batchPending: "Waiting to start", batchPreparing: "Developing story", batchRunning: "Simulating", batchWaiting: "Waiting for next round",
  batchCompleted: "Complete", batchFailed: "Failed", batchCanceled: "Canceled", batchInterrupted: "Interrupted", batchPartial: "Partially complete",
  batchCancelWorld: "Stop simulation", batchContinue: "Continue simulation", batchOpenWorld: "View simulation", batchOpenResult: "Open Multiverse report",
  batchAutomaticHelp: "Progression runs on the server even when this page is closed. Rounds 1 and 2 wait five seconds; round 3 continues immediately.",
  batchCountdown: "The server will continue this simulation after its countdown.", batchDeadline: "The execution time limit was reached. Completed simulations are preserved.",
  batchInterruptedHelp: "Accepted preparation can be resumed. Interrupted simulation histories are preserved; mid-round recovery is not available yet.",
  batchBackToWorlds: "View simulations",
  batchManagedNotice: "Manage round progression on the simulations page.",
} as const
const ko = {
  batchTitle: "Multiverse", batchDescription: "확정한 시나리오에서 독립된 시뮬레이션들을 실행합니다. 각 시뮬레이션은 스토리와 의사결정을 따로 구성합니다.",
  batchSetupHelp: "하나의 시나리오에서 여러 시뮬레이션을 실행합니다. 시뮬레이션마다 상호작용이 달라지며, 모델 호출 동시성은 설정의 한도를 따릅니다.",
  batchWorldCount: "시뮬레이션 수", batchWorldCountHelp: "1~{maximum}개를 선택합니다. 확정한 시나리오는 공유하며, 모델 호출 한도에 따라 요청이 대기할 수 있습니다.",
  batchDuration: "실행 시간 한도 · 분", batchDurationHelp: "준비와 라운드 승인 대기 시간이 포함됩니다. 한도에 도달하면 진행 중인 시뮬레이션을 중단합니다.",
  batchStart: "시뮬레이션 시작", batchCancel: "진행 중인 시뮬레이션 모두 중단", batchResume: "미완료 준비 다시 시도", batchNew: "새 시뮬레이션 설정",
  batchSelect: "시뮬레이션 선택", batchWorld: "시뮬레이션 {index}", batchRound: "라운드 {index} 완료", batchSummary: "전체 {total}개 중 {completed}개 완료 · {failed}개 실패 · {canceled}개 취소 · {interrupted}개 중단",
  batchPending: "시작 대기", batchPreparing: "스토리 구체화", batchRunning: "시뮬레이션 중", batchWaiting: "다음 라운드 대기",
  batchCompleted: "완료", batchFailed: "실패", batchCanceled: "취소됨", batchInterrupted: "중단됨", batchPartial: "일부 완료",
  batchCancelWorld: "시뮬레이션 중단", batchContinue: "시뮬레이션 진행", batchOpenWorld: "시뮬레이션 보기", batchOpenResult: "멀티버스 리포트 보기",
  batchAutomaticHelp: "화면을 닫아도 서버에서 진행합니다. 1·2라운드 뒤에는 5초 대기하고, 3라운드부터는 바로 진행합니다.",
  batchCountdown: "서버에서 대기 시간이 끝나면 이 시뮬레이션을 계속 진행합니다.", batchDeadline: "실행 시간 한도에 도달했습니다. 완료된 시뮬레이션의 결과는 보존됩니다.",
  batchInterruptedHelp: "완료된 준비 작업을 재사용해 다시 시도할 수 있습니다. 중단된 시뮬레이션 기록은 보존되며, 라운드 중간 복구는 아직 지원하지 않습니다.",
  batchBackToWorlds: "시뮬레이션 보기",
  batchManagedNotice: "라운드 진행은 시뮬레이션 페이지에서 관리합니다.",
} as const satisfies Record<keyof typeof en, string>
export const multiverseTexts = { en, ko } as const
