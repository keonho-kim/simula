/**
 * Purpose: Give page-level home and return actions one visible label, size, and emphasis.
 * Pattern: Shared navigation presentation.
 * Usage: Used by workspace pages and RunNavigation without owning their destinations.
 * Related: src/ui/components/navigation/run-navigation.tsx, src/ui/components/layout/workspace-frame.tsx
 */
import { ArrowLeftIcon, HomeIcon } from "lucide-react"
import { Button } from "@/ui/components/ui/button"

export function PageNavigation({ kind, label, onClick }: {
  kind: "home" | "back"; label: string; onClick: () => void
}) {
  const Icon = kind === "home" ? HomeIcon : ArrowLeftIcon
  return <Button type="button" variant="outline" onClick={onClick}>
    <Icon data-icon="inline-start" />{label}
  </Button>
}
