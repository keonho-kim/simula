/**
 * Purpose: Identify numerical claims absent from the source text they cite.
 * Pattern: Pure validation function.
 * Usage: Called by PDF visual-evidence and ScenarioBuilder claim acceptance.
 * Related: src/backend/integrations/documents/pdf-vision.ts, src/backend/core/scenario-builder/evidence.ts
 */
const NUMBER = /(?<![\p{Script=Latin}\p{N}])[-+]?\d+(?:[,.]\d+)*%?(?!\d)/gu

export function unsupportedSourceNumbers(candidate: string, source: string): string[] {
  const sourceNumbers = new Set([...source.matchAll(NUMBER)].map(match => normalizeNumber(match[0])))
  return [...new Set([...candidate.matchAll(NUMBER)]
    .filter(match => !sourceNumbers.has(normalizeNumber(match[0])))
    .map(match => match[0]))]
}

function normalizeNumber(value: string): string {
  const normalized = value.replaceAll(",", "").replace(/^\+/, "")
  const match = /^(-?)(\d+)(?:\.(\d+))?(%)?$/.exec(normalized)
  if (!match) return normalized
  const integer = match[2].replace(/^0+(?=\d)/, "")
  const fraction = match[3]?.replace(/0+$/, "")
  return `${match[1]}${integer}${fraction ? `.${fraction}` : ""}${match[4] ?? ""}`
}
