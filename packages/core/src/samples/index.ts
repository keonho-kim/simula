import { readdir, readFile } from "node:fs/promises"
import { basename, join } from "node:path"
import type { ScenarioSampleDetail, ScenarioSampleSummary } from "@simula/shared"
import { parseScenarioDocument } from "../scenario"

export async function listScenarioSamples(rootDir: string): Promise<ScenarioSampleSummary[]> {
  const files = await sampleFiles(rootDir)
  const samples = await Promise.all(files.map((name) => readScenarioSample(rootDir, name)))
  return samples.map(({ name, title, controls }) => ({ name, title, controls }))
}

export async function readScenarioSample(rootDir: string, name: string): Promise<ScenarioSampleDetail> {
  const safeName = basename(name)
  if (!safeName.endsWith(".md") || safeName === "README.md") {
    throw new Error("Scenario sample not found.")
  }
  const source = await readFile(join(rootDir, safeName), "utf8")
  const scenario = parseScenarioDocument(source, safeName)
  return {
    name: safeName,
    title: extractTitle(scenario.text) ?? safeName.replace(/\.md$/, ""),
    text: scenario.text,
    controls: scenario.controls,
  }
}

async function sampleFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort((a, b) => a.localeCompare(b))
}

function extractTitle(text: string): string | undefined {
  const titleLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("# "))
    .map((line) => line.replace(/^#\s+/, "").trim())
  return titleLines.find((title) => !/^시나리오\s+\d+/i.test(title)) ?? titleLines[0]
}
