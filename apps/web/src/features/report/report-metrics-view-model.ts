import type { RunEvent } from "@simula/shared"

export type ReportMetricKind = "ttft" | "duration" | "tokensPerSecond"

export interface ReportMetricPoint {
  timestamp: string
  value: number
}

export interface ReportMetricSample {
  timestamp: string
  ttft: number
  duration: number
  tokensPerSecond: number
  inputTokens: number
  outputTokens: number
}

export interface ReportMetricMatrixCell {
  value: number | undefined
}

export interface ReportMetricsViewModel {
  samples: ReportMetricSample[]
  averages: Record<ReportMetricKind, number | undefined>
  series: Record<ReportMetricKind, ReportMetricPoint[]>
  matrix: Record<ReportMetricKind, ReportMetricMatrixCell[][]>
  binLabels: string[]
}

export const REPORT_METRIC_BIN_LABELS = ["~500", "~1000", "~1500", "~2000+"] as const

export function buildReportMetrics(events: RunEvent[]): ReportMetricsViewModel {
  const samples = events
    .filter((event): event is Extract<RunEvent, { type: "model.metrics" }> => event.type === "model.metrics")
    .map((event) => {
      const metrics = event.metrics
      return {
        timestamp: event.timestamp,
        ttft: metrics.ttftMs,
        duration: metrics.durationMs,
        tokensPerSecond: metrics.durationMs > 0 ? (metrics.totalTokens / metrics.durationMs) * 1000 : 0,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
      }
    })

  return {
    samples,
    averages: {
      ttft: average(samples.map((sample) => sample.ttft)),
      duration: average(samples.map((sample) => sample.duration)),
      tokensPerSecond: average(samples.map((sample) => sample.tokensPerSecond)),
    },
    series: {
      ttft: samples.map((sample) => ({ timestamp: sample.timestamp, value: sample.ttft })),
      duration: samples.map((sample) => ({ timestamp: sample.timestamp, value: sample.duration })),
      tokensPerSecond: samples.map((sample) => ({ timestamp: sample.timestamp, value: sample.tokensPerSecond })),
    },
    matrix: {
      ttft: buildMetricMatrix(samples, "ttft"),
      duration: buildMetricMatrix(samples, "duration"),
      tokensPerSecond: buildMetricMatrix(samples, "tokensPerSecond"),
    },
    binLabels: [...REPORT_METRIC_BIN_LABELS],
  }
}

function buildMetricMatrix(samples: ReportMetricSample[], kind: ReportMetricKind): ReportMetricMatrixCell[][] {
  return REPORT_METRIC_BIN_LABELS.map((_, outputIndex) =>
    REPORT_METRIC_BIN_LABELS.map((__, inputIndex) => {
      const values = samples
        .filter((sample) => tokenBinIndex(sample.outputTokens) === outputIndex && tokenBinIndex(sample.inputTokens) === inputIndex)
        .map((sample) => sample[kind])
      return { value: average(values) }
    })
  )
}

function tokenBinIndex(tokens: number): number {
  if (tokens <= 500) return 0
  if (tokens <= 1000) return 1
  if (tokens <= 1500) return 2
  return 3
}

function average(values: number[]): number | undefined {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) {
    return undefined
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}
