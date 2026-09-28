/**
 * Purpose: Project simulation preparation state into labeled board columns and entries.
 * Pattern: Pure presentation projection.
 * Usage: Imported by the scenario board during preparation.
 * Related: src/ui/models/simulation/scenario-board.ts, src/ui/pages/scenario-board-page.tsx
 */
import type { UiTexts } from "@/ui/types/i18n"
import { DIGEST_KEYS, type ScenarioBoardState } from "./scenario-board"

export interface BoardItem {
  id: string
  title: string
  generatedTitle?: boolean
  fields?: { label?: string; content: string; generated?: boolean }[]
}
export function scenarioBoardColumns(board: ScenarioBoardState, t: UiTexts): { title: string; items: BoardItem[] }[] {
  const titles = [t.boardCore, t.boardPressures, t.boardConflict, t.boardDirection]
  const scopes = { public: t.boardPublic, "semi-public": t.boardGroup, private: t.boardPrivate, solitary: t.boardSolitary }
  return [
    { title: t.boardWorld, items: DIGEST_KEYS.map((key, index) => ({
      id: key, title: titles[index]!, fields: board.digest[key] ? [{ content: board.digest[key]!, generated: true }] : undefined,
    })) },
    { title: t.boardEvents, items: board.events.length ? board.events.map(event => ({
      id: event.id, title: event.title, generatedTitle: true, fields: [{ content: event.summary, generated: true }],
    })) : [{ id: "events-pending", title: t.boardEvents }] },
    { title: t.boardActions, items: board.actions.length ? board.actions.map<BoardItem>(action => ({
      id: action.id, title: action.label, generatedTitle: true, fields: [
        { label: t.boardScope, content: scopes[action.visibility] },
        { label: t.boardIntent, content: action.intentHint, generated: true },
        { label: t.boardOutcome, content: action.expectedOutcome, generated: true },
      ],
    })).concat(board.config && board.actions.length < board.config.actionCount ? [{ id: "actions-pending", title: "…", fields: undefined }] : [])
      : [{ id: "actions-pending", title: t.boardActions }] },
    { title: t.actorCards, items: board.roster.length ? board.roster.map(entry => {
      const id = `actor-${entry.index}`
      const card = board.cards[id]
      return { id, title: card?.name ?? entry.name, generatedTitle: true, fields: card ? [
        { label: t.boardRole, content: card.role, generated: true }, { label: t.boardBackground, content: card.backgroundHistory, generated: true },
        { label: t.boardPersonality, content: card.personality, generated: true }, { label: t.boardPreference, content: card.preference, generated: true },
      ] : undefined }
    }) : [{ id: "roster-pending", title: t.actorCards }] },
  ]
}
