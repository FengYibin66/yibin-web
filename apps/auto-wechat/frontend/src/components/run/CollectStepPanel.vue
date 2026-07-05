<script setup lang="ts">
import { computed } from 'vue'

import type { StepDetailArtifact } from '@/types/artifacts'
import {
  collectAfterRecencyCount,
  collectMergedCount,
  formatDurationMs,
  parseCollectOutput,
} from '@/utils/collectOutput'

const props = defineProps<{
  stepDetail: StepDetailArtifact | null
  isRegenerating?: boolean
}>()

const parsed = computed(() => parseCollectOutput(props.stepDetail?.output))

const mergedCount = computed(() => {
  if (!parsed.value) {
    return 0
  }
  return collectMergedCount(parsed.value)
})

const afterRecencyCount = computed(() => {
  if (!parsed.value) {
    return 0
  }
  return collectAfterRecencyCount(parsed.value)
})

const sourceFailCount = computed(() => parsed.value?.sourceFailed.length ?? 0)

const hasPartialFailure = computed(() => {
  if (!parsed.value) {
    return false
  }
  return sourceFailCount.value > 0 && parsed.value.articleCount >= 5
})

const funnelSteps = computed(() => {
  if (!parsed.value) {
    return []
  }
  const data = parsed.value
  return [
    { label: '合并去重', value: mergedCount.value, hint: '多源并发拉取后' },
    { label: '时效过滤', value: afterRecencyCount.value, hint: `剔除 ${data.filteredByRecency} 条过期` },
    { label: '关键词过滤', value: data.articleCount, hint: `剔除 ${data.filteredByKeyword} 条非 AI` },
    { label: '写入库', value: data.savedCount, hint: '新增或更新' },
  ]
})
</script>

<template>
  <div class="collect-panel">
    <el-empty
      v-if="isRegenerating"
      description="正在重新采集资讯…"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'pending'"
      description="等待执行，或点击「重新生成此节点」开始采集"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'running'"
      description="正在从 25+ RSS 源并发采集，请稍候…"
    />

    <template v-else-if="parsed">
      <section class="collect-panel__summary">
        <div class="collect-panel__metric">
          <span class="collect-panel__metric-value">{{ parsed.sourceSuccess }}/{{ parsed.sourceTotal }}</span>
          <span class="collect-panel__metric-label">源成功</span>
        </div>
        <div class="collect-panel__metric">
          <span class="collect-panel__metric-value">{{ parsed.articleCount }}</span>
          <span class="collect-panel__metric-label">可用文章</span>
        </div>
        <div class="collect-panel__metric">
          <span class="collect-panel__metric-value">{{ parsed.savedCount }}</span>
          <span class="collect-panel__metric-label">入库</span>
        </div>
        <div class="collect-panel__metric">
          <span class="collect-panel__metric-value">{{ formatDurationMs(stepDetail?.durationMs) }}</span>
          <span class="collect-panel__metric-label">耗时</span>
        </div>
      </section>

      <el-alert
        v-if="hasPartialFailure"
        type="warning"
        show-icon
        :closable="false"
        title="部分源采集失败，已用其余源继续"
        class="collect-panel__alert"
      />

      <el-alert
        v-if="sourceFailCount > 0"
        type="error"
        show-icon
        :closable="false"
        :title="`失败源 ${sourceFailCount} 个`"
        class="collect-panel__alert"
      >
        <template #default>
          <div class="collect-panel__failed-list">
            <el-tag
              v-for="name in parsed.sourceFailed"
              :key="name"
              type="danger"
              effect="plain"
              size="small"
            >
              {{ name }}
            </el-tag>
          </div>
        </template>
      </el-alert>

      <section class="collect-panel__funnel">
        <h3 class="collect-panel__section-title">
          采集漏斗
        </h3>
        <div class="collect-panel__funnel-track">
          <div
            v-for="(step, index) in funnelSteps"
            :key="step.label"
            class="collect-panel__funnel-step"
          >
            <div class="collect-panel__funnel-bar-wrap">
              <div
                class="collect-panel__funnel-bar"
                :style="{
                  width: mergedCount > 0
                    ? `${Math.max(12, (step.value / mergedCount) * 100)}%`
                    : '12%',
                }"
              />
            </div>
            <div class="collect-panel__funnel-meta">
              <span class="collect-panel__funnel-label">
                <span
                  v-if="index < funnelSteps.length - 1"
                  class="collect-panel__funnel-arrow"
                >→</span>
                {{ step.label }}
              </span>
              <strong class="collect-panel__funnel-value">{{ step.value }}</strong>
              <span class="collect-panel__funnel-hint">{{ step.hint }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="collect-panel__notes">
        <h3 class="collect-panel__section-title">
          说明
        </h3>
        <ul class="collect-panel__note-list">
          <li>默认采集最近 2 天内容（<code>COLLECT_DAYS</code>）</li>
          <li>媒体/社区源会按 AI 关键词过滤；官方博客与中文源豁免</li>
          <li>单源失败不阻断全链路，可用文章 ≥ 5 即继续排序</li>
          <li>下一步「排序」将从可用文章中选出 Top 10</li>
        </ul>
      </section>
    </template>

    <el-empty
      v-else-if="stepDetail?.status === 'succeeded'"
      description="采集已完成，但暂无结构化统计数据"
    />

    <details
      v-if="stepDetail?.output && !isRegenerating"
      class="collect-panel__raw"
    >
      <summary>原始 JSON</summary>
      <pre class="collect-panel__json">{{ JSON.stringify(stepDetail.output, null, 2) }}</pre>
    </details>
  </div>
</template>

<style scoped lang="scss">
.collect-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.collect-panel__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.collect-panel__metric {
  padding: 16px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
}

.collect-panel__metric-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.collect-panel__metric-label {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.collect-panel__alert {
  margin: 0;
}

.collect-panel__failed-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.collect-panel__section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.collect-panel__funnel {
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.collect-panel__funnel-track {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.collect-panel__funnel-step {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 12px;
  align-items: center;
}

.collect-panel__funnel-bar-wrap {
  height: 8px;
  border-radius: 4px;
  background: var(--el-fill-color);
  overflow: hidden;
}

.collect-panel__funnel-bar {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--el-color-primary-light-3), var(--el-color-primary));
  transition: width 0.3s ease;
}

.collect-panel__funnel-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.collect-panel__funnel-label {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.collect-panel__funnel-arrow {
  margin-right: 4px;
  color: var(--el-text-color-placeholder);
}

.collect-panel__funnel-value {
  font-size: 18px;
  color: var(--el-color-primary);
}

.collect-panel__funnel-hint {
  color: var(--el-text-color-secondary);
}

.collect-panel__notes {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.collect-panel__note-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;

  code {
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--el-fill-color);
  }
}

.collect-panel__raw {
  font-size: 12px;
  color: var(--el-text-color-secondary);

  summary {
    cursor: pointer;
    user-select: none;
  }
}

.collect-panel__json {
  margin: 8px 0 0;
  padding: 14px;
  border-radius: 8px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
  max-height: 320px;
}

@media (max-width: 768px) {
  .collect-panel__summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .collect-panel__funnel-step {
    grid-template-columns: 1fr;
  }
}
</style>
