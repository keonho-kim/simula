import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { SettingsPage } from "./types"

export function SettingsSidebar({ page, t, onSelect }: {
  page: SettingsPage
  t: UiTexts
  onSelect: (page: SettingsPage) => void
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/20 p-2">
      <SidebarButton
        active={page === "providers"}
        title={t.settingsProviders}
        subtitle={t.settingsProviderConnections}
        onClick={() => onSelect("providers")}
      />
      <SidebarButton
        active={page === "roles"}
        title={t.settingsRoles}
        subtitle={t.settingsRoleGeneration}
        onClick={() => onSelect("roles")}
      />
    </div>
  )
}

function SidebarButton({ active, title, subtitle, onClick }: {
  active: boolean
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md px-2.5 py-2 text-left text-sm transition-colors",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
      )}
      onClick={onClick}
    >
      <div className="font-medium">{title}</div>
      <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
    </button>
  )
}

