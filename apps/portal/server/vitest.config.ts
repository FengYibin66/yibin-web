import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    // 集成测试各自建独立的内存库，但它们共享 process.env（setSession 等读 env），
    // 并发改 env 会互相污染 → 串行执行。用例总数少，代价可忽略。
    fileParallelism: false,
  },
})
