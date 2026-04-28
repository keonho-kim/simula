import { useEffect, useState } from "react"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function NumberField({ label, value, step, onChange }: {
  label: string
  value: number
  step?: string
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) {
      setText(String(value))
    }
  }, [editing, value])

  const commitText = (nextText: string) => {
    setText(nextText)
    if (!nextText.trim()) {
      return
    }
    const nextValue = Number(nextText)
    if (Number.isFinite(nextValue)) {
      onChange(nextValue)
    }
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        step={step}
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(event) => commitText(event.target.value)}
        onBlur={() => {
          setEditing(false)
          const nextValue = Number(text)
          setText(text.trim() && Number.isFinite(nextValue) ? String(nextValue) : String(value))
        }}
      />
    </Field>
  )
}

export function OptionalNumberField({ label, value, step, onChange }: {
  label: string
  value: number | undefined
  step?: string
  onChange: (value: number | undefined) => void
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) {
      setText(value === undefined ? "" : String(value))
    }
  }, [editing, value])

  const commitText = (nextText: string) => {
    setText(nextText)
    if (!nextText.trim()) {
      onChange(undefined)
      return
    }
    const nextValue = Number(nextText)
    if (Number.isFinite(nextValue)) {
      onChange(nextValue)
    }
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        step={step}
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(event) => commitText(event.target.value)}
        onBlur={() => {
          setEditing(false)
          if (!text.trim()) {
            setText("")
            return
          }
          const nextValue = Number(text)
          setText(Number.isFinite(nextValue) ? String(nextValue) : value === undefined ? "" : String(value))
        }}
      />
    </Field>
  )
}

export function JsonTextarea({ label, value, placeholder, onChange }: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        className="min-h-28 font-mono text-xs"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

