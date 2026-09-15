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
  },
  server: {
    proxy: {
      '/api': process.env.SIMULA_API_ORIGIN ?? 'http://localhost:3001',
    },
  },
})
