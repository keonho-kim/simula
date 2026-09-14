import { calculateLayout } from "./calculate"
import type { LayoutInput } from "./protocol"

self.onmessage = (event: MessageEvent<LayoutInput>) => {
  self.postMessage(calculateLayout(event.data))
}
