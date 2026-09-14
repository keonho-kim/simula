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
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: 'graph-vendor',
              test: /node_modules[\\/](@sigma|sigma|graphology|graphology-layout-forceatlas2)[\\/]/,
              priority: 30,
              maxSize: 300000,
            },
            {
              name: 'markdown-vendor',
              test: /node_modules[\\/](react-markdown|remark-|rehype-|unified|micromark|mdast-|hast-|unist-|katex)[\\/]/,
              priority: 25,
              maxSize: 300000,
            },
            {
              name: 'ui-vendor',
              test: /node_modules[\\/](radix-ui|lucide-react|sonner|class-variance-authority|tailwind-merge|clsx)[\\/]/,
              priority: 20,
              maxSize: 300000,
            },
            {
              name: 'state-vendor',
              test: /node_modules[\\/](@tanstack|zustand)[\\/]/,
              priority: 15,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 10,
              maxSize: 300000,
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
