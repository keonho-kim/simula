import { useMemo, useState } from "react"
import type { RunEvent } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { MetricPanel } from "@/ui/components/metrics/llm-metrics-panel"
import { LineChart } from "@/ui/components/metrics/line-chart"
import { buildPerformanceReport } from "@/ui/models/report/performance"
import { Field, FieldLabel } from "@/ui/components/ui/field"
import { Input } from "@/ui/components/ui/input"
import { Button } from "@/ui/components/ui/button"
import { roleLabel, REPORT_SYSTEM_ROLES, type ReportSystemRole } from "@/ui/models/report/role-diagnostics"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/ui/components/ui/select"

export function ReportPerformancePanel({ events, t }: { events: RunEvent[]; t: UiTexts }) {
  const [role, setRole] = useState("all")
  const [minTokens, setMinTokens] = useState("")
  const [maxTokens, setMaxTokens] = useState("")
  const [selectedRole, setSelectedRole] = useState<ReportSystemRole>()
  const report = useMemo(
    () =>
      buildPerformanceReport(
        events,
        {
          role,
          minTokens: minTokens ? Number(minTokens) : undefined,
          maxTokens: maxTokens ? Number(maxTokens) : undefined
        },
        t
      ),
    [events, role, minTokens, maxTokens, t]
  )
  const { series, roles: roleRows } = report
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-md border p-3">
        <h2 className="text-sm font-medium">{t.reportMetricFilters}</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger aria-label={t.role} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{t.reportAllRoles}</SelectItem>
                {REPORT_SYSTEM_ROLES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {roleLabel(key, t)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Field className="w-36">
            <FieldLabel htmlFor="report-min-tokens">{t.minToken}</FieldLabel>
            <Input
              id="report-min-tokens"
              type="number"
              min={0}
              className="w-36"
              value={minTokens}
              onChange={(event) => setMinTokens(event.target.value)}
            />
          </Field>
          <Field className="w-36">
            <FieldLabel htmlFor="report-max-tokens">{t.maxToken}</FieldLabel>
            <Input
              id="report-max-tokens"
              type="number"
              min={0}
              className="w-36"
              value={maxTokens}
              onChange={(event) => setMaxTokens(event.target.value)}
            />
          </Field>
        </div>
      </section>
      <p className="text-xs text-muted-foreground">
        {t.reportUsageCoverage}: {report.measuredCount} / {report.sampleCount} · {t.reportErrorScope}
      </p>
      <section aria-label={t.llmMetrics} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {series.map((item) => (
          <MetricPanel key={item.title} series={item} t={t} summary />
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {series.slice(0, 3).map((item, index) => (
          <article key={item.title} className="min-w-0">
            <h2 className="mb-2 text-sm font-medium">
              {[t.ttft, t.metricDuration, t.metricTokensPerSecond][index]}
            </h2>
            {item.points ? (
              <>
                <LineChart id={`report-${item.title}`} points={item.points} t={t} />
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <time>{item.points.chunks[0]?.points[0]?.timestamp}</time>
                  <time>{item.points.chunks.at(-1)?.points.at(-1)?.timestamp}</time>
                </div>
              </>
            ) : null}
          </article>
        ))}
      </section>
      <section className="overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">{t.reportRoleCalls}</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              {[t.role, t.reportCalls, t.reportTotalDuration, t.reportErrors, t.reportRetries].map(
                (label) => (
                  <th key={label} className="p-2 font-medium">
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {roleRows.map((row) => (
              <tr key={row.key} className="border-b">
                <td className="p-2">
                  <Button variant="link" onClick={() => setSelectedRole(row.key)}>
                    {roleLabel(row.key, t)}
                  </Button>
                </td>
                <td className="p-2 tabular-nums">{row.calls}</td>
                <td className="p-2 tabular-nums">
                  {row.duration !== undefined ? `${row.duration.toLocaleString()} ms` : "—"}
                </td>
                <td className="p-2">{row.errors}</td>
                <td className="p-2">{row.retries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {selectedRole ? (
        <section
          aria-label={t.reportCallDetails}
          className="flex max-h-[480px] flex-col gap-2 overflow-y-auto"
        >
          <h2 className="text-sm font-semibold">
            {roleLabel(selectedRole, t)} · {t.reportCallDetails}
          </h2>
          {report.diagnostics
            .filter((event) => event.role === selectedRole)
            .map((event) => (
              <section key={event.id} className="border-b py-2">
                <h3 className="text-xs font-medium">
                  {event.title} · {event.timestamp}
                </h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">
                  {event.details || event.body}
                </p>
              </section>
            ))}
        </section>
      ) : null}
    </div>
  )
}
