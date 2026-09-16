import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { createActionBoardStream } from "./stream"
import { emptyScenarioBoard, updateScenarioBoard } from "@/ui/models/simulation/scenario-board"

test("partial JSON produces live named fields and resets on retry without accepting a draft", async () => {
  let board = emptyScenarioBoard()
  const emit = async (event: RunEvent) => { board = updateScenarioBoard(board, [event]) }
  const stream = await createActionBoardStream("run", emit)
  await stream.onDelta('{"label":"사과')
  expect(board.drafts["actions-pending"]?.label).toBe("사과")
  await stream.onDelta(' 방식 확인","intentHint":"상대의 의도를 확인할 때","expectedOutcome":"오해를 줄인다"}')
  expect(board.drafts["actions-pending"]).toEqual({ label: "사과 방식 확인", intentHint: "상대의 의도를 확인할 때", expectedOutcome: "오해를 줄인다" })
  expect(board.actions).toHaveLength(0)
  const retry = await createActionBoardStream("run", emit)
  expect(board.drafts["actions-pending"]?.label).toBe("")
  await retry.onDelta('{"label":"새 행동"}')
  expect(board.drafts["actions-pending"]?.label).toBe("새 행동")
})
