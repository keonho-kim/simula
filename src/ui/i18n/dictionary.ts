import { commonTexts } from "@/ui/i18n/messages/common"
import { reportTexts } from "@/ui/i18n/messages/report"
import { simulationTexts } from "@/ui/i18n/messages/simulation"

const en = {
  ...commonTexts.en,
  ...simulationTexts.en,
  ...reportTexts.en,
} as const

const ko = {
  ...commonTexts.ko,
  ...simulationTexts.ko,
  ...reportTexts.ko,
} as const satisfies Record<keyof typeof en, string>

export const dictionary = { en, ko } as const
