<script setup lang="ts">
import { computed } from 'vue'

import { DIGEST_TAG_SUGGESTIONS } from '@/constants/digestTags'
import type { RankedItem } from '@/types/artifacts'
import { formatScore, scoreTagType } from '@/utils/rankOutput'

const props = defineProps<{
  index: number
  item: RankedItem
  removable?: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()

const tagsModel = computed({
  get() {
    return props.item.tags ?? []
  },
  set(value: string[]) {
    props.item.tags = value
  },
})

const availableSuggestions = computed(() => {
  const selected = new Set(props.item.tags ?? [])
  return DIGEST_TAG_SUGGESTIONS.filter((tag) => !selected.has(tag))
})

function addTag(tag: string): void {
  const current = props.item.tags ?? []
  if (current.includes(tag)) {
    return
  }
  props.item.tags = [...current, tag]
}

function openOriginal(): void {
  if (!props.item.url) {
    return
  }
  window.open(props.item.url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <article class="digest-item">
    <div class="digest-item__rank">
      {{ index }}
    </div>
    <div class="digest-item__body">
      <div class="digest-item__toolbar">
        <div class="digest-item__badges">
          <el-tag
            v-if="item.score > 0"
            :type="scoreTagType(item.score)"
            size="small"
            effect="plain"
          >
            {{ formatScore(item.score) }}
          </el-tag>
        </div>
        <div class="digest-item__actions">
          <el-button
            v-if="item.url"
            link
            type="primary"
            size="small"
            @click="openOriginal"
          >
            打开原文
          </el-button>
          <el-button
            v-if="removable"
            link
            type="danger"
            size="small"
            @click="emit('remove')"
          >
            移除
          </el-button>
        </div>
      </div>

      <el-input
        v-model="item.title"
        placeholder="标题"
        class="digest-item__title"
      />

      <el-input
        v-model="item.summaryZh"
        type="textarea"
        :rows="3"
        placeholder="中文摘要（2-3 句，面向公众号读者）"
        class="digest-item__summary"
        maxlength="300"
        show-word-limit
      />

      <p
        v-if="item.reason"
        class="digest-item__reason"
      >
        <span class="digest-item__reason-label">选题理由</span>
        {{ item.reason }}
      </p>

      <div class="digest-item__tag-field">
        <label class="digest-item__tag-label">标签</label>
        <el-input-tag
          v-model="tagsModel"
          placeholder="输入后按回车添加，或点下方常用标签"
          size="small"
          class="digest-item__tags"
        />
        <div
          v-if="availableSuggestions.length"
          class="digest-item__tag-suggestions"
        >
          <span class="digest-item__tag-suggestions-label">常用</span>
          <el-button
            v-for="tag in availableSuggestions"
            :key="tag"
            size="small"
            round
            @click="addTag(tag)"
          >
            + {{ tag }}
          </el-button>
        </div>
      </div>

      <div class="digest-item__meta">
        <el-input
          v-model="item.source"
          placeholder="来源"
          size="small"
        />
        <el-input
          v-model="item.url"
          placeholder="原文 URL"
          size="small"
        />
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.digest-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.digest-item__rank {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.digest-item__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.digest-item__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.digest-item__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.digest-item__actions {
  display: flex;
  gap: 4px;
}

.digest-item__reason {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}

.digest-item__reason-label {
  margin-right: 6px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.digest-item__tag-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.digest-item__tag-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.digest-item__tags {
  width: 100%;
}

.digest-item__tag-suggestions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.digest-item__tag-suggestions-label {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.digest-item__meta {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
}

@media (max-width: 640px) {
  .digest-item__meta {
    grid-template-columns: 1fr;
  }
}
</style>
