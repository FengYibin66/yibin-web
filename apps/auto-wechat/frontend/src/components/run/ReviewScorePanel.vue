<script setup lang="ts">
import { computed } from 'vue'

import {
  parseReview,
  scoreColor,
  scoreLabel,
  scoreStatus,
} from '@/utils/reviewScore'

const props = defineProps<{
  review: Record<string, unknown> | null
  compact?: boolean
}>()

const parsed = computed(() => parseReview(props.review))

const overallStatus = computed(() => {
  if (!parsed.value) {
    return 'info' as const
  }
  return scoreStatus(parsed.value.overallScore)
})
</script>

<template>
  <div
    v-if="parsed"
    class="review-score"
    :class="{ 'review-score--compact': compact }"
  >
    <div class="review-score__overall">
      <div
        class="review-score__ring"
        :style="{ '--score-color': scoreColor(parsed.overallScore) }"
      >
        <span class="review-score__value">{{ parsed.overallScore }}</span>
        <span class="review-score__unit">分</span>
      </div>
      <div class="review-score__summary">
        <el-tag
          :type="overallStatus"
          effect="dark"
          size="small"
        >
          综合 · {{ scoreLabel(parsed.overallScore) }}
        </el-tag>
        <p class="review-score__hint">
          建议性评分，不阻塞发布
        </p>
        <p
          v-if="parsed.summary"
          class="review-score__text"
        >
          {{ parsed.summary }}
        </p>
      </div>
    </div>

    <div
      v-if="parsed.dimensions.length"
      class="review-score__grid"
    >
      <div
        v-for="dim in parsed.dimensions"
        :key="dim.id"
        class="review-score__card"
      >
        <div class="review-score__card-head">
          <span class="review-score__card-name">{{ dim.name }}</span>
          <span
            class="review-score__card-score"
            :style="{ color: scoreColor(dim.score) }"
          >
            {{ dim.score }}
          </span>
        </div>
        <el-progress
          :percentage="dim.score"
          :status="scoreStatus(dim.score)"
          :stroke-width="6"
          :show-text="false"
        />
        <p
          v-if="dim.feedback"
          class="review-score__card-feedback"
        >
          {{ dim.feedback }}
        </p>
      </div>
    </div>

    <el-alert
      v-else-if="parsed.legacy"
      type="info"
      show-icon
      :closable="false"
      title="旧版质检结果"
      description="重新执行「质检」节点可获多维度打分。"
      class="review-score__legacy"
    />

    <ul
      v-if="parsed.issues.length"
      class="review-score__issues"
    >
      <li
        v-for="(issue, index) in parsed.issues"
        :key="index"
      >
        {{ issue }}
      </li>
    </ul>
  </div>
  <el-empty
    v-else
    description="暂无质检结果"
  />
</template>

<style scoped lang="scss">
.review-score {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.review-score__overall {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.review-score__ring {
  flex-shrink: 0;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 4px solid var(--score-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--score-color);
  background: color-mix(in srgb, var(--score-color) 8%, transparent);
}

.review-score__value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.review-score__unit {
  font-size: 12px;
  margin-top: 2px;
}

.review-score__summary {
  flex: 1;
  min-width: 0;
}

.review-score__hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.review-score__text {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.review-score__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.review-score__card {
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.review-score__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.review-score__card-name {
  font-size: 13px;
  font-weight: 600;
}

.review-score__card-score {
  font-size: 20px;
  font-weight: 700;
}

.review-score__card-feedback {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
}

.review-score__issues {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.review-score--compact .review-score__grid {
  grid-template-columns: 1fr 1fr;
}

.review-score--compact .review-score__ring {
  width: 64px;
  height: 64px;
}

.review-score--compact .review-score__value {
  font-size: 22px;
}
</style>
