<script setup lang="ts">
import { computed } from 'vue'

import { STEP_LABELS, type PipelineStep } from '@/constants/pipeline'
import { getStepLabel, getStepStatusTagType } from '@/utils/format'

import type { PipelineRunStep } from '@/types/pipeline'

const props = defineProps<{
  steps: PipelineRunStep[]
}>()

const orderedSteps = computed(() => {
  const stepOrder = Object.keys(STEP_LABELS) as PipelineStep[]
  return [...props.steps].sort((a, b) => {
    return stepOrder.indexOf(a.step) - stepOrder.indexOf(b.step)
  })
})
</script>

<template>
  <el-timeline>
    <el-timeline-item
      v-for="item in orderedSteps"
      :key="item.step"
      :timestamp="item.finishedAt ?? item.startedAt ?? ''"
      placement="top"
    >
      <div class="step-row">
        <span class="step-name">{{ getStepLabel(item.step) }}</span>
        <el-tag
          :type="getStepStatusTagType(item.status)"
          size="small"
        >
          {{ item.status }}
        </el-tag>
      </div>
      <p
        v-if="item.errorMessage"
        class="step-error"
      >
        {{ item.errorMessage }}
      </p>
    </el-timeline-item>
  </el-timeline>
</template>

<style scoped lang="scss">
.step-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-name {
  font-weight: 500;
}

.step-error {
  margin: 8px 0 0;
  color: var(--el-color-danger);
  font-size: 13px;
}
</style>
