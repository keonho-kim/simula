/**
 * Purpose: Verify neutral preselection and visible saved model text without opening a menu.
 * Pattern: Server-rendered form contract test.
 * Usage: Executed by bun test.
 * Related: src/ui/components/settings/model-field.tsx
 */
import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import { ModelField } from "./model-field"
import type { RoleSettings } from "@/shared/settings"

const active: RoleSettings = { provider: "openai", model: "saved-model", temperature: 0.2, maxTokens: 1000, timeoutSeconds: 60 }

test("unselected providers show guidance rather than a default model or failure", () => {
  const html = renderToStaticMarkup(<ModelField role="storyBuilder" active={active} models={[]}
    providerSelected={false} connectionReady={false} loading={false} error={false} t={dictionary.en} setDraft={() => undefined} />)
  expect(html).toContain("Select a provider first")
  expect(html).not.toContain("saved-model")
  expect(html).not.toContain("Failed to load model list")
})

test("saved model text is present even before Radix mounts its item collection", () => {
  const html = renderToStaticMarkup(<ModelField role="storyBuilder" active={active} models={[active.model]}
    providerSelected connectionReady loading={false} error={false} t={dictionary.en} setDraft={() => undefined} />)
  expect(html).toContain("saved-model")
  expect(html).toContain("bg-background")
})
