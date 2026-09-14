import type { ActorGraph } from "../types"
import type { LayoutOutput } from "./protocol"

// One in-flight layout per renderer. Termination cancels obsolete CPU work as well as its result.
export function createLayoutWorker(onResult: (positions: LayoutOutput) => void, onError: (error: Error) => void) {
  let worker: Worker | undefined
  const cancel = () => {
    worker?.terminate()
    worker = undefined
  }
  return {
    cancel,
    request(graph: ActorGraph) {
      cancel()
      const current = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" })
      worker = current
      current.onmessage = (event: MessageEvent<LayoutOutput>) => {
        if (worker !== current) return
        cancel()
        onResult(event.data)
      }
      current.onerror = (event) => {
        if (worker !== current) return
        cancel()
        onError(new Error(`Graph layout failed: ${event.message}`))
      }
      current.postMessage({
        nodes: graph.mapNodes((id, { x, y, size }) => ({ id, x, y, size })),
        edges: graph.mapEdges((id, { weight }, source, target) => ({ id, source, target, weight })),
      })
    },
  }
}
