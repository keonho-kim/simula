/**
 * Purpose: Configure the Next.js browser bundle without changing backend ownership.
 * Pattern: Build Configuration.
 * Usage: Loaded by the Next.js development server and production build.
 * Related: src/app/layout.tsx, server.ts
 */
import type { NextConfig } from "next"

const config: NextConfig = {
  reactStrictMode: true,
}

export default config
