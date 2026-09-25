/**
 * Purpose: Compose the complete English and Korean application dictionaries.
 * Pattern: Localization composition.
 * Usage: Imported by locale selection and UI text types.
 * Related: src/ui/i18n/messages/document-builder.ts, src/ui/types/i18n.ts
 */
import { analyticalReportTexts } from "@/ui/i18n/messages/analytical-report"
import { commonTexts } from "@/ui/i18n/messages/common"
import { documentBuilderTexts } from "@/ui/i18n/messages/document-builder"
import { reportTexts } from "@/ui/i18n/messages/report"
import { multiverseTexts } from "@/ui/i18n/messages/multiverse"
import { simulationTexts } from "@/ui/i18n/messages/simulation"

const en = {
  ...commonTexts.en,
  ...analyticalReportTexts.en,
  ...documentBuilderTexts.en,
  ...simulationTexts.en,
  ...reportTexts.en,
  ...multiverseTexts.en,
} as const

const ko = {
  ...commonTexts.ko,
  ...analyticalReportTexts.ko,
  ...documentBuilderTexts.ko,
  ...simulationTexts.ko,
  ...reportTexts.ko,
  ...multiverseTexts.ko,
} as const satisfies Record<keyof typeof en, string>

export const dictionary = { en, ko } as const
