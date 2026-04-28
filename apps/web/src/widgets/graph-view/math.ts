export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

export function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3)
}

export function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

