/**
 * Purpose: Encode one bounded document image region as a multimodal model input.
 * Pattern: Input adapter.
 * Usage: Used by visual document tasks before invoking the role input adapter.
 * Related: src/backend/integrations/llm/types.ts, src/backend/integrations/llm/invoke.ts
 */
import type { ChatInput } from "./types"

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

export interface ModelImage {
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  bytes: Uint8Array
}

export function createVisionInput(prompt: string, image: ModelImage): ChatInput {
  if (!prompt.trim()) throw new Error("A visual document task requires an instruction.")
  if (!IMAGE_MIME_TYPES.has(image.mimeType)) throw new Error("Unsupported model image type.")
  if (!image.bytes.byteLength || image.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Model image must contain between 1 byte and 8 MiB; render a smaller region.")
  }
  return [{ role: "user", content: [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}` } },
  ] }]
}
