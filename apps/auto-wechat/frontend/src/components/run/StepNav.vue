<script setup lang="ts">
import { computed } from 'vue'

import { PIPELINE_STEPS, STEP_LABELS, type PipelineStep, type StepStatus } from '@/constants/pipeline'
import { getStepStatusLabel, getStepStatusTagType } from '@/utils/format'
import { isStepAtOrAfter } from '@/utils/pipelineSteps'

import type { PipelineRunStep } from '@/types/pipeline'

const props = defineProps<{
  steps: PipelineRunStep[]
  activeStep: PipelineStep
  regeneratingFrom?: PipelineStep | null
}>()

const emit = defineEmits<{
  select: [step: PipelineStep]
}>()

const orderedSteps = computed(() => {
  return PIPELINE_STEPS.map((step) => {
    const found = props.steps.find((item) => item.step === step)
    return found ?? { step, status: 'pending' as StepStatus, errorMessage: null, startedAt: null, finishedAt: null }
  })
})

function handleSelect(step: PipelineStep): void {
  emit('select', step)
}

function isRegeneratingStep(step: PipelineStep, status: StepStatus): boolean {
  return Boolean(
    props.regeneratingFrom
    && status === 'running'
    && isStepAtOrAfter(step, props.regeneratingFrom),
  )
}

function stepIcon(status: StepStatus): string {
  if (status === 'running') {
    return '…'
  }
  if (status === 'succeeded') {
    return '✓'
  }
  if (status === 'failed') {
    return '✕'
  }
  if (status === 'skipped') {
    return '–'
  }
  return '○'
}
</script>

<template>
  <nav class="step-nav">
    <p class="step-nav__title">
      Pipeline 节点
    </p>
    <button
      v-for="item in orderedSteps"
      :key="item.step"
      type="button"
      class="step-nav__item"
      :class="{ 'step-nav__item--active': activeStep === item.step }"
      @click="handleSelect(item.step)"
    >
      <span
        class="step-nav__icon"
        :class="`step-nav__icon--${item.status}`"
      >
        {{ stepIcon(item.status) }}
      </span>
      <span class="step-nav__body">
        <span class="step-nav__label">{{ STEP_LABELS[item.step] }}</span>
        <span class="step-nav__status">
          {{ getStepStatusLabel(item.status, isRegeneratingStep(item.step, item.status)) }}
        </span>
      </span>
      <el-tag
        :type="getStepStatusTagType(item.status)"
        size="small"
        effect="plain"
        class="step-nav__tag"
      >
        {{ getStepStatusLabel(item.status, isRegeneratingStep(item.step, item.status)) }}
      </el-tag>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.step-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-nav__title {
  margin: 0 0 8px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--el-text-color-placeholder);
}

.step-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &--active {
    background: var(--el-color-primary-light-9);

    .step-nav__label {
      color: var(--el-color-primary);
      font-weight: 600;
    }
  }
}

.step-nav__icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);

  &--running {
    background: var(--el-color-warning-light-8);
    color: var(--el-color-warning);
  }

  &--succeeded {
    background: var(--el-color-success-light-8);
    color: var(--el-color-success);
  }

  &--failed {
    background: var(--el-color-danger-light-8);
    color: var(--el-color-danger);
  }
}

.step-nav__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.step-nav__label {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.step-nav__status {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  text-transform: uppercase;
}

.step-nav__tag {
  flex-shrink: 0;
}

@media (max-width: 960px) {
  .step-nav {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .step-nav__title,
  .step-nav__status,
  .step-nav__tag {
    display: none;
  }

  .step-nav__item {
    flex-shrink: 0;
    min-width: 100px;
  }
}
</style>
