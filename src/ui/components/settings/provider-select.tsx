/**
 * Purpose: Show an explicit provider selection with a neutral unconfigured state.
 * Pattern: Controlled form field.
 * Usage: Rendered by the role settings section.
 * Related: src/ui/components/ui/select.tsx, src/ui/models/settings/settings-options.ts
 */
import type { UiTexts } from "@/ui/types/i18n"
import type { ModelProvider } from "@/shared"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select"
import { cspProviders, openAICompatibleProviders, providerLabel, providers } from "@/ui/models/settings/settings-options"

export function ProviderSelect({ value, onChange, t }: { value?: ModelProvider; onChange: (provider: ModelProvider) => void; t: UiTexts }) {
  return (
    <Select value={value ?? ""} onValueChange={(next) => {
      const selected = providers.find(provider => provider.value === next)
      if (selected) onChange(selected.value)
    }}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t.settingsSelectProvider}>{value ? providerLabel(value) : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t.settingsCloudProviders}</SelectLabel>
          {cspProviders.map((provider) => (
            <SelectItem key={provider.value} value={provider.value}>
              {provider.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>{t.settingsCompatibleProviders}</SelectLabel>
          {openAICompatibleProviders.map((provider) => (
            <SelectItem key={provider.value} value={provider.value}>
              {provider.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
