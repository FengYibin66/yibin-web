import { onUnmounted, ref, type Ref } from 'vue'

import { POLL_INTERVAL_MS } from '@/constants/pipeline'

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>
  intervalMs?: number
  shouldStop?: (data: T) => boolean
}

export function usePolling<T>(options: UsePollingOptions<T>) {
  const data: Ref<T | null> = ref(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let timerId: ReturnType<typeof setInterval> | null = null

  async function tick(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const result = await options.fetcher()
      data.value = result

      if (options.shouldStop?.(result)) {
        stop()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '轮询失败'
    } finally {
      loading.value = false
    }
  }

  function start(): void {
    stop()
    void tick()
    timerId = setInterval(() => {
      void tick()
    }, options.intervalMs ?? POLL_INTERVAL_MS)
  }

  function stop(): void {
    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
  }

  onUnmounted(stop)

  return {
    data,
    loading,
    error,
    start,
    stop,
    refresh: tick,
  }
}
