<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'

import DigestItemCard from '@/components/editor/DigestItemCard.vue'
import {
  countTagDistribution,
  groupItemsByPrimaryTag,
  UNTAGGED_LABEL,
} from '@/constants/digestTags'
import type { RankedItem, RunArtifacts, StepDetailArtifact } from '@/types/artifacts'
import { formatDurationMs } from '@/utils/collectOutput'
import {
  countItemsWithSummaryZh,
  countItemsWithTags,
  enrichStatsFromArtifacts,
  parseEnrichOutput,
} from '@/utils/enrichOutput'

const MIN_DIGEST_ITEMS = 1

const items = defineModel<RankedItem[]>({ required: true })
const viewMode = ref<'list' | 'grouped'>('grouped')

const props = defineProps<{
  stepDetail: StepDetailArtifact | null
  artifacts: RunArtifacts | null
  isRegenerating?: boolean
}>()

const parsed = computed(() => {
  return parseEnrichOutput(props.stepDetail?.output) ?? enrichStatsFromArtifacts(props.artifacts)
})

const modeLabel = computed(() => {
  const mode = parsed.value?.meta.mode
  if (mode === 'llm') {
    return 'LLM 中文富化'
  }
  if (mode === 'passthrough') {
    return '直通（未富化）'
  }
  return '未知模式'
})

const summaryZhCount = computed(() => countItemsWithSummaryZh(items.value))
const tagsCount = computed(() => countItemsWithTags(items.value))

const canRemove = computed(() => items.value.length > MIN_DIGEST_ITEMS)

const tagDistribution = computed(() => countTagDistribution(items.value))
const groupedItems = computed(() => groupItemsByPrimaryTag(items.value))
const untaggedCount = computed(() => {
  return tagDistribution.value.find((entry) => entry.tag === UNTAGGED_LABEL)?.count ?? 0
})

function itemGlobalIndex(item: RankedItem): number {
  const index = items.value.findIndex((entry) => entry.url === item.url && entry.title === item.title)
  return index >= 0 ? index + 1 : 0
}

async function handleRemove(index: number): Promise<void> {
  if (!canRemove.value) {
    return
  }

  const item = items.value[index]
  try {
    await ElMessageBox.confirm(
      `确定从 Digest 中移除「${item?.title || '该条目'}」？保存后生效。`,
      '移除条目',
      { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' },
    )
    items.value = items.value.filter((_, i) => i !== index)
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="enrich-panel">
    <el-empty
      v-if="isRegenerating"
      description="正在生成中文摘要与标签…"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'pending'"
      description="等待执行，需先完成排序"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'running'"
      description="LLM 正在为 Top 10 生成中文摘要…"
    />

    <template v-else-if="items.length > 0">
      <section
        v-if="parsed"
        class="enrich-panel__summary"
      >
        <div class="enrich-panel__metric">
          <span class="enrich-panel__metric-value">{{ items.length }}</span>
          <span class="enrich-panel__metric-label">Digest 条数</span>
        </div>
        <div class="enrich-panel__metric">
          <span class="enrich-panel__metric-value">{{ summaryZhCount }}</span>
          <span class="enrich-panel__metric-label">已有中文摘要</span>
        </div>
        <div class="enrich-panel__metric">
          <span class="enrich-panel__metric-value">{{ tagsCount }}</span>
          <span class="enrich-panel__metric-label">已打标签</span>
        </div>
        <div class="enrich-panel__metric">
          <span class="enrich-panel__metric-value">{{ formatDurationMs(stepDetail?.durationMs) }}</span>
          <span class="enrich-panel__metric-label">耗时</span>
        </div>
      </section>

      <div
        v-if="parsed"
        class="enrich-panel__mode"
      >
        <el-tag
          :type="parsed.meta.mode === 'llm' ? 'success' : 'warning'"
          effect="plain"
        >
          {{ modeLabel }}
        </el-tag>
        <span class="enrich-panel__mode-hint">
          标签将驱动选题分板块与写作小节；改完后点击右上角「保存 Digest」
        </span>
      </div>

      <section
        v-if="tagDistribution.length"
        class="enrich-panel__tags-overview"
      >
        <h3 class="enrich-panel__section-title">
          标签分布
        </h3>
        <div class="enrich-panel__tag-chips">
          <el-tag
            v-for="entry in tagDistribution"
            :key="entry.tag"
            :type="entry.tag === UNTAGGED_LABEL ? 'warning' : 'info'"
            effect="plain"
          >
            {{ entry.tag }} × {{ entry.count }}
          </el-tag>
        </div>
        <p
          v-if="untaggedCount > 0"
          class="enrich-panel__tag-warning"
        >
          有 {{ untaggedCount }} 条未分类，建议补标签以便组稿
        </p>
      </section>

      <el-alert
        v-if="parsed?.meta.mode === 'passthrough'"
        type="warning"
        show-icon
        :closable="false"
        title="富化未走 LLM"
        class="enrich-panel__alert"
      >
        <template #default>
          <span v-if="parsed.meta.error">{{ parsed.meta.error }}</span>
          <span v-else>请手动补充中文摘要，或重新生成此节点。</span>
        </template>
      </el-alert>

      <section class="enrich-panel__list">
        <div class="enrich-panel__list-head">
          <h3 class="enrich-panel__section-title">
            Top 10 素材
            <span class="enrich-panel__section-hint">可编辑 · 写作输入</span>
          </h3>
          <el-radio-group
            v-model="viewMode"
            size="small"
          >
            <el-radio-button value="grouped">
              按标签
            </el-radio-button>
            <el-radio-button value="list">
              列表
            </el-radio-button>
          </el-radio-group>
        </div>

        <div
          v-if="viewMode === 'list'"
          class="enrich-panel__items"
        >
          <DigestItemCard
            v-for="(item, index) in items"
            :key="item.url || `${index}-${item.title}`"
            :index="index + 1"
            :item="item"
            :removable="canRemove"
            @remove="handleRemove(index)"
          />
        </div>

        <div
          v-else
          class="enrich-panel__groups"
        >
          <section
            v-for="group in groupedItems"
            :key="group.tag"
            class="enrich-panel__group"
          >
            <h4 class="enrich-panel__group-title">
              {{ group.tag }}
              <span class="enrich-panel__group-count">{{ group.items.length }} 条</span>
            </h4>
            <div class="enrich-panel__items">
              <DigestItemCard
                v-for="item in group.items"
                :key="item.url || item.title"
                :index="itemGlobalIndex(item)"
                :item="item"
                :removable="canRemove"
                @remove="handleRemove(items.findIndex((entry) => entry.url === item.url && entry.title === item.title))"
              />
            </div>
          </section>
        </div>
      </section>

      <section class="enrich-panel__notes">
        <h3 class="enrich-panel__section-title">
          说明
        </h3>
        <ul class="enrich-panel__note-list">
          <li>中文摘要 <code>summaryZh</code> 将用于后续选题与写作</li>
          <li>标签决定选题「分板块大纲」与正文 <code>## 小节</code> 标题</li>
          <li>至少保留 1 条；建议维持 8–10 条以保证日报质量</li>
        </ul>
      </section>
    </template>

    <el-empty
      v-else-if="stepDetail?.status === 'succeeded'"
      description="富化已完成，但 Digest 为空"
    />

    <el-empty
      v-else
      description="Digest 尚未生成，请先完成 Rank/Enrich 或重新生成"
    />

    <details
      v-if="stepDetail?.output && !isRegenerating"
      class="enrich-panel__raw"
    >
      <summary>原始 JSON</summary>
      <pre class="enrich-panel__json">{{ JSON.stringify(stepDetail.output, null, 2) }}</pre>
    </details>
  </div>
</template>

<style scoped lang="scss">
.enrich-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.enrich-panel__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.enrich-panel__metric {
  padding: 16px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
}

.enrich-panel__metric-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.enrich-panel__metric-label {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.enrich-panel__mode {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.enrich-panel__mode-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.enrich-panel__alert {
  margin: 0;
}

.enrich-panel__tags-overview {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.enrich-panel__tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.enrich-panel__tag-warning {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--el-color-warning);
}

.enrich-panel__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.enrich-panel__section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.enrich-panel__groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.enrich-panel__group-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.enrich-panel__group-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.enrich-panel__section-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.enrich-panel__items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.enrich-panel__notes {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.enrich-panel__note-list {
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

.enrich-panel__raw {
  font-size: 12px;
  color: var(--el-text-color-secondary);

  summary {
    cursor: pointer;
    user-select: none;
  }
}

.enrich-panel__json {
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
  .enrich-panel__summary {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
