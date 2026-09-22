/**
 * Purpose: Calculate reusable bounded statistics for simulation analysis.
 * Pattern: Pure function module.
 * Usage: Imported by network, behavior, and run-level analysis.
 * Related: src/shared/analysis/network.ts, src/shared/analysis/metrics.ts
 */
export function entropy(counts: number[]): number {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total <= 0) {
    return 0
  }
  return counts.reduce((sum, count) => {
    const probability = count / total
    return probability > 0 ? sum - probability * Math.log2(probability) : sum
  }, 0)
}

export function normalizedEntropy(counts: number[]): number {
  const categoryCount = counts.filter((count) => count > 0).length
  if (categoryCount <= 1) {
    return 0
  }
  return entropy(counts) / Math.log2(categoryCount)
}

export function gini(values: number[]): number {
  const positive = values.filter((value) => value > 0).sort((left, right) => left - right)
  const total = positive.reduce((sum, value) => sum + value, 0)
  if (!positive.length || total <= 0) {
    return 0
  }
  const weighted = positive.reduce((sum, value, index) => sum + (2 * (index + 1) - positive.length - 1) * value, 0)
  return weighted / (positive.length * total)
}

export function hhi(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return 0
  }
  return values.reduce((sum, value) => {
    const share = value / total
    return sum + share * share
  }, 0)
}

export function average(values: number[]): number {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) {
    return 0
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}

export function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const value of left) {
    if (right.has(value)) {
      count += 1
    }
  }
  return count
}
