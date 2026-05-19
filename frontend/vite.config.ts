/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/booking': {
        target: 'http://localhost:3000',
        bypass(req) {
          // Browser page loads (Accept: text/html) → serve SPA from Vite
          // API fetch calls (Accept: application/json or */*)  → proxy to backend
          if (req.headers.accept?.includes('text/html')) return req.url
        },
      },
      '/payment': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: [
        'src/main.tsx',
        'src/components/theme.ts',
        'src/types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
