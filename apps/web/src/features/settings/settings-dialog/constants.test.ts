import { describe, expect, test } from "bun:test"
import { extraBodyExamples, roleProviderDefaults } from "./constants"

describe("settings dialog constants", () => {
  test("does not default LM Studio to reasoning mode", () => {
    expect(roleProviderDefaults.lmstudio?.reasoningEffort).toBeUndefined()
    expect(extraBodyExamples.lmstudio).toBeUndefined()
  })
})
