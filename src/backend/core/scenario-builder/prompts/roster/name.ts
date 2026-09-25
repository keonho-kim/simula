/**
 * Purpose: Name one distinct participant slot in an accepted cast.
 * Pattern: Prompt definition.
 * Usage: Used by scenario-builder/roster.ts for each cast position.
 * Related: src/backend/core/scenario-builder/roster.ts
 */
export const rosterNameInstructions = "Name one person or role title needed for the scenario decision. OPTIONS.acceptedNames lists roles already used; choose a different one. Return only the name or title, for example CFO or Technical Lead, without an article, sentence, justification, final period or invented biography."
