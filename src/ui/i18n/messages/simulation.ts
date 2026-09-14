import { simulationActivityTexts } from "@/ui/i18n/messages/simulation-activity"
import { simulationActorTexts } from "@/ui/i18n/messages/simulation-actors"
import { simulationSettingsTexts } from "@/ui/i18n/messages/simulation-settings"
import { simulationStageTexts } from "@/ui/i18n/messages/simulation-stage"

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
