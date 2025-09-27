import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup-integration.ts'],
    globals: true,
    css: true,
    include: [
      '**/__tests__/integration/**/*.{test,spec}.{js,ts,jsx,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/__tests__/e2e/**',
      '**/tests/e2e/**',
      '**/__tests__/components/**',
      '**/__tests__/lib/**',
      '**/*.{e2e,spec}.{js,ts,jsx,tsx}'
    ],
    testTimeout: 15000,
    env: {
      // Load test environment variables
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_bW9jay1rZXktZm9yLXRlc3RpbmctcHVycG9zZXMtb25seQ==',
      CLERK_SECRET_KEY: 'sk_test_bW9jay1rZXktZm9yLXRlc3RpbmctcHVycG9zZXMtb25seQ==',
      NODE_ENV: 'test',
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
      NEXT_PUBLIC_PROJECTS_API_URL: 'http://localhost:8000',
      NEXT_PUBLIC_BACKLOG_API_URL: 'http://localhost:8000',
      NEXT_PUBLIC_READINESS_API_URL: 'http://localhost:8000',
      NEXT_PUBLIC_PROMPT_BUILDER_API_URL: 'http://localhost:8000',
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})