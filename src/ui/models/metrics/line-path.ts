import { chartSamples, type MetricHistory } from "@/ui/models/metrics/sample-history"

export const chartWidth = 100
export const chartHeight = 42
const chartPadding = 3
export const baselineY = chartHeight - chartPadding

export function buildLineGeometry(points: MetricHistory): { path: string; latestY: number } {
  if (!points.length) {
    return { path: "", latestY: baselineY }
  }
  const max = points.max
  const coordinates = chartSamples(points).map((point) => ({
    x: xForIndex(point.index, points.length),
    y: valueY(max, point.value),
  }))
  return { path: smoothPath(coordinates), latestY: coordinates[coordinates.length - 1].y }
}

function valueY(max: number, value: number): number {
  if (max <= 0) {
    return baselineY
  }
  const usableHeight = chartHeight - chartPadding * 2
  return baselineY - (value / max) * usableHeight
}

export function firstX(length: number): number {
  return xForIndex(0, length)
}

export function lastX(length: number): number {
  return xForIndex(Math.max(0, length - 1), length)
}

function xForIndex(index: number, length: number): number {
  if (length <= 1) {
    return chartWidth - chartPadding
  }
  const usableWidth = chartWidth - chartPadding * 2
  return chartPadding + (index / (length - 1)) * usableWidth
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  const [first, ...rest] = points
  if (!first) {
    return ""
  }
  return rest.reduce((path, point, index) => {
    const previous = points[index] ?? first
    const controlX = (previous.x + point.x) / 2
    return `${path} C ${controlX.toFixed(2)} ${previous.y.toFixed(2)}, ${controlX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }, `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`)
}
