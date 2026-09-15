import { useEffect, useState } from "react"
import type { RunEvent } from "@/shared"
import { emptyScenarioBoard, updateScenarioBoard } from "@/ui/models/simulation/scenario-board"

export function useBoardPreview(runId: string | undefined, itemId: string | undefined) {
  const [snapshot, setSnapshot] = useState(() => ({ runId, itemId, board: emptyScenarioBoard(), disconnected: false }))
  useEffect(() => {
    setSnapshot({ runId, itemId, board: emptyScenarioBoard(), disconnected: false })
    if (!runId || !itemId) return
    const source = new EventSource(`/api/runs/${encodeURIComponent(runId)}/board-preview?item=${encodeURIComponent(itemId)}`)
    source.addEventListener("board.updated", (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as RunEvent
      setSnapshot(current => ({ runId, itemId, board: updateScenarioBoard(current.board, [event]), disconnected: false }))
    })
    source.onerror = () => setSnapshot(current => ({ ...current, disconnected: true }))
    source.onopen = () => setSnapshot(current => ({ ...current, disconnected: false }))
    return () => source.close()
  }, [runId, itemId])
  return snapshot.runId === runId && snapshot.itemId === itemId ? {
    fields: itemId ? snapshot.board.drafts[itemId] : undefined, disconnected: snapshot.disconnected,
  } : { fields: undefined, disconnected: false }
}
