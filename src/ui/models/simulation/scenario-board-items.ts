import type { UiTexts } from "@/ui/types/i18n"
import { DIGEST_KEYS, type ScenarioBoardState } from "./scenario-board"

export interface BoardItem {
  id: string
  title: string
  fields?: { label?: string; content: string }[]
}
export function scenarioBoardColumns(board: ScenarioBoardState, t: UiTexts): { title: string; items: BoardItem[] }[] {
  const titles = [t.boardCore, t.boardPressures, t.boardConflict, t.boardDirection]
  const scopes = { public: t.boardPublic, "semi-public": t.boardGroup, private: t.boardPrivate, solitary: t.boardSolitary }
  return [
    { title: t.boardWorld, items: DIGEST_KEYS.map((key, index) => ({
      id: key, title: titles[index]!, fields: board.digest[key] ? [{ content: board.digest[key]! }] : undefined,
    })) },
    { title: t.boardEvents, items: board.events.length ? board.events.map(event => ({
      id: event.id, title: event.title, fields: [{ content: event.summary }],
    })) : [{ id: "events-pending", title: t.boardEvents }] },
    { title: t.boardActions, items: board.actions.length ? board.actions.map<BoardItem>(action => ({
      id: action.id, title: action.label, fields: [
        { label: t.boardScope, content: scopes[action.visibility] },
        { label: t.boardIntent, content: action.intentHint },
        { label: t.boardOutcome, content: action.expectedOutcome },
      ],
    })).concat(board.config && board.actions.length < board.config.actionCount ? [{ id: "actions-pending", title: "…", fields: undefined }] : [])
      : [{ id: "actions-pending", title: t.boardActions }] },
    { title: t.actorCards, items: board.roster.length ? board.roster.map(entry => {
      const id = `actor-${entry.index}`
      const card = board.cards[id]
      return { id, title: card?.name ?? entry.name, fields: card ? [
        { label: t.boardRole, content: card.role }, { label: t.boardBackground, content: card.backgroundHistory },
        { label: t.boardPersonality, content: card.personality }, { label: t.boardPreference, content: card.preference },
      ] : undefined }
    }) : Array.from({ length: board.config?.actorCount ?? 1 }, (_, index) => ({
      id: `actor-${index + 1}`, title: t.boardActor.replace("{number}", String(index + 1)),
    })) },
  ]
}
