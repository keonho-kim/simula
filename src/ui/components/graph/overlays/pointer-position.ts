import type { CSSProperties } from "react"

export function edgePreviewStyleFromEvent(event: MouseEvent | TouchEvent | PointerEvent, container: HTMLDivElement | null): CSSProperties {
  if (!container) {
    return { right: 12, top: 12 }
  }
  const point = pointerClientPoint(event)
  const rect = container.getBoundingClientRect()
  const width = 340
  const minX = Math.min(width / 2 + 12, rect.width / 2)
  const maxX = Math.max(minX, rect.width - width / 2 - 12)
  const x = clamp(point.x - rect.left, minX, maxX)
  const y = point.y - rect.top
  if (y < 150) {
    return {
      left: x,
      top: Math.min(rect.height - 12, y + 18),
      transform: "translateX(-50%)",
    }
  }
  return {
    left: x,
    top: y - 14,
    transform: "translate(-50%, -100%)",
  }
}

function pointerClientPoint(event: MouseEvent | TouchEvent | PointerEvent): { x: number; y: number } {
  if ("touches" in event && event.touches[0]) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }
  if ("changedTouches" in event && event.changedTouches[0]) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
  }
  return "clientX" in event ? { x: event.clientX, y: event.clientY } : { x: 0, y: 0 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
