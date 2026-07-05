import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { PipelineRun } from '@/types/pipeline'

export const usePipelineStore = defineStore('pipeline', () => {
  const currentRun = ref<PipelineRun | null>(null)

  function setCurrentRun(run: PipelineRun | null): void {
    currentRun.value = run
  }

  return {
    currentRun,
    setCurrentRun,
  }
})
