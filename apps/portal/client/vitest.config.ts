import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
  resolve: {
    // 与 tsconfig.json 的 paths 保持一致
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@portal-server': path.resolve(__dirname, '../server/src'),
    },
  },
})
