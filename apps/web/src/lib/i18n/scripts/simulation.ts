import { simulationActivityTexts } from "./simulation-activity"
import { simulationActorTexts } from "./simulation-actors"
import { simulationSettingsTexts } from "./simulation-settings"
import { simulationStageTexts } from "./simulation-stage"

const en = {
  ...simulationSettingsTexts.en,
  ...simulationStageTexts.en,
  ...simulationActivityTexts.en,
  ...simulationActorTexts.en,
} as const

const ko = {
  ...simulationSettingsTexts.ko,
  ...simulationStageTexts.ko,
  ...simulationActivityTexts.ko,
  ...simulationActorTexts.ko,
} as const satisfies Record<keyof typeof en, string>

export const simulationTexts = { en, ko } as const
