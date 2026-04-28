import { commonTexts } from "./scripts/common"
import { reportTexts } from "./scripts/report"
import { simulationTexts } from "./scripts/simulation"

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
