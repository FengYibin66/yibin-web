import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // 只收 __tests__ 下的用例。
    //
    // 必须显式限定：vitest 默认的 include 会匹配 `e2e/*.spec.ts`，而那些文件
    // 由 Playwright 驱动，在 vitest 里 import 会直接抛
    // "Playwright Test did not expect test.describe() to be called here"。
    // 两个 runner 的职责边界靠这里划清：vitest 管单测，playwright 管 E2E。
    include: ['__tests__/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'out/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
