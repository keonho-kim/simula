/**
 * Purpose: Configure the web development server and production bundle boundaries.
 * Pattern: Build Configuration.
 * Usage: Loaded by Vite through the @simula/web workspace scripts.
 * Related: src/ui/main.tsx, src/ui/components/markdown/markdown-content.tsx
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const webRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  root: repoRoot,
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  build: {
    outDir: `${webRoot}/dist`,
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'markdown-math',
              test: /node_modules[\\/](?:.*[\\/])?katex[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': process.env.SIMULA_API_ORIGIN ?? 'http://localhost:3001',
    },
  },
})
