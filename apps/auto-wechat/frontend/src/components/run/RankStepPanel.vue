<script setup lang="ts">
import { computed } from 'vue'

import RankItemCard from '@/components/run/RankItemCard.vue'
import type { RunArtifacts, StepDetailArtifact } from '@/types/artifacts'
import { formatDurationMs } from '@/utils/collectOutput'
import {
  collectStatsFromArtifacts,
  parseRankOutput,
  resolveRankItems,
} from '@/utils/rankOutput'

const props = defineProps<{
  stepDetail: StepDetailArtifact | null
  artifacts: RunArtifacts | null
  isRegenerating?: boolean
}>()

const parsed = computed(() => parseRankOutput(props.stepDetail?.output))

const resolved = computed(() => resolveRankItems(props.stepDetail?.output, props.artifacts))

const collectStats = computed(() => collectStatsFromArtifacts(props.artifacts))

const modeLabel = computed(() => {
  const mode = parsed.value?.meta.mode
  if (mode === 'llm') {
    return 'LLM 智能排序'
  }
  if (mode === 'rule') {
    return '规则降级排序'
  }
  return '未知模式'
})

const inputCount = computed(() => {
  return (
    parsed.value?.meta.inputArticleCount
    ?? collectStats.value?.articleCount
    ?? 0
  )
})

const candidateCount = computed(() => parsed.value?.meta.candidateCount ?? 0)
</script>

<template>
  <div class="rank-panel">
    <el-empty
      v-if="isRegenerating"
      description="正在重新排序…"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'pending'"
      description="等待执行，需先完成采集"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'running'"
      description="LLM 正在从候选文章中精选 Top 10…"
    />

    <template v-else-if="parsed || resolved.items.length > 0">
      <section
        v-if="parsed"
        class="rank-panel__summary"
      >
        <div class="rank-panel__metric">
          <span class="rank-panel__metric-value">{{ parsed.topCount }}</span>
          <span class="rank-panel__metric-label">Top 10</span>
        </div>
        <div class="rank-panel__metric">
          <span class="rank-panel__metric-value">{{ inputCount || '—' }}</span>
          <span class="rank-panel__metric-label">采集可用</span>
        </div>
        <div class="rank-panel__metric">
          <span class="rank-panel__metric-value">{{ candidateCount || '—' }}</span>
          <span class="rank-panel__metric-label">送审候选</span>
        </div>
        <div class="rank-panel__metric">
          <span class="rank-panel__metric-value">{{ formatDurationMs(stepDetail?.durationMs) }}</span>
          <span class="rank-panel__metric-label">耗时</span>
        </div>
      </section>

      <div
        v-if="parsed"
        class="rank-panel__mode"
      >
        <el-tag
          :type="parsed.usedFallback ? 'warning' : 'success'"
          effect="plain"
        >
          {{ modeLabel }}
        </el-tag>
        <span
          v-if="inputCount > 0"
          class="rank-panel__mode-hint"
        >
          从 {{ inputCount }} 条可用文章中
          <template v-if="candidateCount > 0">
            取预评分 Top {{ candidateCount }} 送 LLM
          </template>
          精选 {{ parsed.topCount }} 条
        </span>
      </div>

      <el-alert
        v-if="parsed?.usedFallback"
        type="warning"
        show-icon
        :closable="false"
        title="已使用规则降级排序"
        class="rank-panel__alert"
      >
        <template #default>
          <span v-if="parsed.meta.error">{{ parsed.meta.error }}</span>
          <span v-else>LLM 排序不可用或结果不足，已按信源权重 × 时效规则选出 Top 10。</span>
        </template>
      </el-alert>

      <el-alert
        v-if="resolved.fromDigest"
        type="info"
        show-icon
        :closable="false"
        title="展示的是 Digest 快照"
        description="该 Run 在排序步骤未存档条目列表（旧版流水线）。内容来自富化后的 Digest，供参考。"
        class="rank-panel__alert"
      />

      <section
        v-if="resolved.items.length > 0"
        class="rank-panel__list"
      >
        <h3 class="rank-panel__section-title">
          精选结果
          <span class="rank-panel__section-hint">只读 · 编辑请在「富化」节点</span>
        </h3>
        <div class="rank-panel__items">
          <RankItemCard
            v-for="(item, index) in resolved.items"
            :key="item.url || `${index}-${item.title}`"
            :index="index + 1"
            :item="item"
          />
        </div>
      </section>

      <section class="rank-panel__notes">
        <h3 class="rank-panel__section-title">
          说明
        </h3>
        <ul class="rank-panel__note-list">
          <li>每条包含推荐度（score）与选题理由（reason）</li>
          <li>LLM 会尽量去除同一事件的重复报道</li>
          <li>下一步「富化」将生成中文摘要 <code>summaryZh</code></li>
        </ul>
      </section>
    </template>

    <el-empty
      v-else-if="stepDetail?.status === 'succeeded'"
      description="排序已完成，但暂无结果数据"
    />

    <details
      v-if="stepDetail?.output && !isRegenerating"
      class="rank-panel__raw"
    >
      <summary>原始 JSON</summary>
      <pre class="rank-panel__json">{{ JSON.stringify(stepDetail.output, null, 2) }}</pre>
    </details>
  </div>
</template>

<style scoped lang="scss">
.rank-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rank-panel__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.rank-panel__metric {
  padding: 16px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
}

.rank-panel__metric-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.rank-panel__metric-label {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.rank-panel__mode {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.rank-panel__mode-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.rank-panel__alert {
  margin: 0;
}

.rank-panel__section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.rank-panel__section-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.rank-panel__items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rank-panel__notes {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.rank-panel__note-list {
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

.rank-panel__raw {
  font-size: 12px;
  color: var(--el-text-color-secondary);

  summary {
    cursor: pointer;
    user-select: none;
  }
}

.rank-panel__json {
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
  .rank-panel__summary {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
