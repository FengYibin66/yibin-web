<script setup lang="ts">
import type { RankedItem } from '@/types/artifacts'
import { formatScore, scoreTagType } from '@/utils/rankOutput'

defineProps<{
  index: number
  item: RankedItem
}>()
</script>

<template>
  <article class="rank-item">
    <div class="rank-item__rank">
      {{ index }}
    </div>
    <div class="rank-item__body">
      <div class="rank-item__headline">
        <a
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          class="rank-item__title"
        >
          {{ item.title }}
        </a>
        <el-tag
          v-if="item.score > 0"
          :type="scoreTagType(item.score)"
          size="small"
          effect="plain"
        >
          {{ formatScore(item.score) }}
        </el-tag>
      </div>
      <p
        v-if="item.reason"
        class="rank-item__reason"
      >
        {{ item.reason }}
      </p>
      <p
        v-else-if="item.summary"
        class="rank-item__reason rank-item__reason--muted"
      >
        {{ item.summary }}
      </p>
      <div
        v-if="item.source"
        class="rank-item__source"
      >
        {{ item.source }}
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.rank-item {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.rank-item__rank {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  font-size: 13px;
  font-weight: 600;
}

.rank-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rank-item__headline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.rank-item__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-decoration: none;
  line-height: 1.45;

  &:hover {
    color: var(--el-color-primary);
  }
}

.rank-item__reason {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.55;
}

.rank-item__reason--muted {
  color: var(--el-text-color-secondary);
}

.rank-item__source {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
