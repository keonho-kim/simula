/**
 * Purpose: Persist a completed scenario as the shared input for multiverse preparation.
 * Pattern: Browser persistence use case.
 * Usage: Called by HomeView before mounting the document scenario workflow.
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/browser-storage/scenario-builder-session.ts
 */
import type { ScenarioDraft } from "@/ui/types/scenario"
import { worldControlsFromScenario, validMultiverse, type ScenarioBuilderForm } from "@/ui/models/scenario-builder/launch-options"
import { storeAttachment } from "./database/attachments/store"
import { deleteAttachment } from "./database/attachments/delete"
import { writeWorkingDraft } from "./database/drafts/write-working"
import { writeDocumentScenarioSession } from "./scenario-builder-session"

export async function prepareScenarioDraft(draft: ScenarioDraft): Promise<void> {
  if (!draft.text.trim() || !validMultiverse(draft.multiverse)) throw new Error("Invalid scenario launch options")
  const file = new File([draft.text], draft.sourceName, { type: "text/markdown" })
  const attachment = await storeAttachment(file)
  const form: ScenarioBuilderForm = { context: "", situation: "auto", participants: [], fastMode: draft.controls.fastMode,
    multiverse: draft.multiverse, controls: worldControlsFromScenario(draft.controls) }
  try { await writeWorkingDraft("new-scenario", "new-scenario", { form, attachments: [attachment] }) }
  catch (error) { await deleteAttachment(attachment.id); throw error }
  writeDocumentScenarioSession({})
}
