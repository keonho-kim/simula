import type { RunManifest } from "@simula/shared"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UiTexts } from "@/lib/i18n"

interface RunSelectorProps {
  runs: RunManifest[]
  selectedRunId?: string
  t?: UiTexts
  onSelect: (runId: string | undefined) => void
}

export function RunSelector({ runs, selectedRunId, t, onSelect }: RunSelectorProps) {
  return (
    <Select value={selectedRunId} onValueChange={onSelect}>
      <SelectTrigger aria-label={t?.chooseRun ?? "Select run"} className="h-9 w-[280px] rounded-md bg-card/80 shadow-none ring-1 ring-border/60">
        <SelectValue placeholder={t?.noRuns ?? "No runs yet"} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {runs.map((run) => (
            <SelectItem key={run.id} value={run.id}>
              {run.scenarioName ?? run.id} · {run.status}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
