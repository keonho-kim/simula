import type { ActionCatalog, ActionVisibility } from "@/shared"

export function actionCatalogPrompt(context: string, visibility: ActionVisibility, count: number, existing: ActionCatalog, error?: string): string {
  return `Planner actionCatalog.
Define reusable, concrete actions appropriate to this scenario. Actors will later select only a program-assigned code.
Scope: ${visibility}
Batch size: ${count}
Return exactly ${count} lines. Each line: short action label | when/why to use it | expected effect
No JSON, codes, headings, markdown tables, commentary, or extra pipe characters.
Use the scenario language for all three fields. Labels must fit a small UI badge (40 characters maximum).
Each condition and effect must be one short sentence (200 characters maximum).
Vary the actual mechanisms: investigate, request evidence, disclose, negotiate, propose, support, oppose, commit resources, de-escalate, delay, or revise a position when relevant.
Do not create near-synonyms, numbered variants, generic "public move" labels, or labels containing an actor's entire preference.
Actions must be plausible for scenario participants within their own authority. Describe conditions without hardcoding actor names.
Public means visible to everyone; semi-public means a limited group; private means a confidential counterpart; solitary means self-directed without a recipient.
Do not promise success: expected effects describe attempts, not guaranteed outcomes.

Scenario and planner context:
${context}

Already defined labels (do not duplicate):
${Object.values(existing).map((action) => `- ${action.id} (${action.visibility}): ${action.label}`).join("\n") || "None"}
${error ? `\nPrevious response was invalid: ${error}\nValid actions from earlier responses have already been kept in the list above. Return ONLY the requested missing number of NEW actions. Do not repeat or rename retained actions; choose different concrete mechanisms.` : ""}`
}
