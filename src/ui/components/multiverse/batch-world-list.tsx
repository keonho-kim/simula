/**
 * Purpose: Select a simulation using visible desktop summaries or a compact-screen selector.
 * Pattern: Controlled navigation presentation.
 * Usage: Rendered by MultiversePanel with summaries only; sibling details remain unmounted.
 * Related: src/ui/components/multiverse/batch-world-status.ts, src/ui/styles/simulations.css
 */
import { ChevronRightIcon } from "lucide-react"
import type { BatchWorld } from "@/shared/multiverse"
import type { UiTexts } from "@/ui/types/i18n"
import { Badge } from "@/ui/components/ui/badge"
import { Field, FieldLabel } from "@/ui/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/ui/select"
import { batchStatusText } from "./batch-world-status"

export function BatchWorldList({ worlds, selectedId, onSelect, language, t }: {
  worlds: readonly BatchWorld[]; selectedId?: string; onSelect: (id: string) => void; language: "en" | "ko"; t: UiTexts
}) {
  const number = new Intl.NumberFormat(language)
  const name = (index: number) => t.batchWorld.replace("{index}", number.format(index))
  return <>
    <nav className="simulation-list" aria-label={t.batchSelect}><h2>{t.batchSelect}</h2>
      <ul>{worlds.map(world => <li key={world.id}><button type="button" aria-label={name(world.index)}
        aria-describedby={`simulation-status-${world.id}`}
        aria-current={world.id === selectedId ? "true" : undefined} onClick={() => onSelect(world.id)}>
        <span className="simulation-list-number">{number.format(world.index)}</span><span className="min-w-0 flex-1">
          <strong>{name(world.index)}</strong><Badge id={`simulation-status-${world.id}`} variant="secondary" data-status={world.status}>{batchStatusText(world.status, t)}</Badge>
        </span><ChevronRightIcon aria-hidden="true" /></button></li>)}</ul>
    </nav>
    <div className="simulation-list-compact"><Field><FieldLabel htmlFor="batch-world">{t.batchSelect}</FieldLabel>
      <Select value={selectedId} onValueChange={onSelect}><SelectTrigger id="batch-world" className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>{worlds.map(world => <SelectItem key={world.id} value={world.id}>{name(world.index)} · {batchStatusText(world.status, t)}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    </Field></div>
  </>
}
