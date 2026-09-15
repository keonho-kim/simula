export interface RunSession {
  runId?: string
  viewMode?: "home" | "simulation" | "report"
  autoContinue?: boolean
  handledRounds?: number[]
}
const key = "simula.run-session"
export function readRunSession(): RunSession {
  if (typeof window === "undefined") return {}
  const saved = sessionStorage.getItem(key)
  return saved ? JSON.parse(saved) as RunSession : {}
}
export function updateRunSession(update: RunSession): void {
  sessionStorage.setItem(key, JSON.stringify({ ...readRunSession(), ...update }))
}
