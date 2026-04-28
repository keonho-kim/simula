export function buildRunId(sourceName?: string): string {
  const stamp = new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\..+$/, "Z")
  const safeName = (sourceName ?? "scenario")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
  return `${stamp}.${safeName || "scenario"}`
}

