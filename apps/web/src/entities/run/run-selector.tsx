import type { RunManifest } from "@simula/shared"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RunSelectorProps {
  runs: RunManifest[]
  selectedRunId?: string
  onSelect: (runId: string | undefined) => void
}

export function RunSelector({ runs, selectedRunId, onSelect }: RunSelectorProps) {
  return (
    <Select value={selectedRunId} onValueChange={onSelect}>
      <SelectTrigger aria-label="Select run" className="h-9 w-[280px] rounded-md bg-card/80 shadow-none ring-1 ring-border/60">
        <SelectValue placeholder="No runs yet" />
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
