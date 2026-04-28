import type { ModelProvider } from "@simula/shared"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cspProviders, openAICompatibleProviders } from "./constants"

export function ProviderSelect({ value, onChange }: { value: ModelProvider; onChange: (provider: ModelProvider) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ModelProvider)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>CSP</SelectLabel>
          {cspProviders.map((provider) => (
            <SelectItem key={provider.value} value={provider.value}>
              {provider.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>OpenAI Compatible</SelectLabel>
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

