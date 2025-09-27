import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    css: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/__tests__/e2e/**',
      '**/tests/e2e/**',
      '**/__tests__/integration/**',
      '**/*.{e2e,spec}.{js,ts,jsx,tsx}'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})