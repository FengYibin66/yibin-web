<script setup lang="ts">
import { LAYOUT_TEMPLATE_ARTICLE_TYPES } from '@/constants/layoutTemplate'

import type { LayoutTemplateFeaturedFilter, LayoutTemplateSvgFilter } from '@/composables/useLayoutTemplateLibrary'

defineProps<{
  keyword: string
  filterArticleType: string
  filterSvg: LayoutTemplateSvgFilter
  filterFeatured: LayoutTemplateFeaturedFilter
  filterTag: string
  allTags: string[]
  filteredCount: number
  totalCount: number
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:filterArticleType': [value: string]
  'update:filterSvg': [value: LayoutTemplateSvgFilter]
  'update:filterFeatured': [value: LayoutTemplateFeaturedFilter]
  'update:filterTag': [value: string]
}>()
</script>

<template>
  <div class="layout-template-filters">
    <el-input
      :model-value="keyword"
      placeholder="搜索名称、说明、标签…"
      clearable
      class="layout-template-filters__search"
      @update:model-value="emit('update:keyword', $event)"
    />
    <el-select
      :model-value="filterArticleType"
      placeholder="文章类型"
      clearable
      style="width: 140px"
      @update:model-value="emit('update:filterArticleType', $event)"
    >
      <el-option
        v-for="opt in LAYOUT_TEMPLATE_ARTICLE_TYPES"
        :key="opt.value"
        :label="opt.label"
        :value="opt.value"
      />
    </el-select>
    <el-select
      :model-value="filterSvg"
      style="width: 120px"
      @update:model-value="emit('update:filterSvg', $event)"
    >
      <el-option
        label="全部交互"
        value="all"
      />
      <el-option
        label="含 SVG"
        value="yes"
      />
      <el-option
        label="纯静态"
        value="no"
      />
    </el-select>
    <el-select
      :model-value="filterFeatured"
      style="width: 120px"
      @update:model-value="emit('update:filterFeatured', $event)"
    >
      <el-option
        label="全部"
        value="all"
      />
      <el-option
        label="仅精选"
        value="yes"
      />
    </el-select>
    <el-select
      :model-value="filterTag"
      placeholder="标签"
      clearable
      style="width: 140px"
      @update:model-value="emit('update:filterTag', $event)"
    >
      <el-option
        v-for="tag in allTags"
        :key="tag"
        :label="tag"
        :value="tag"
      />
    </el-select>
    <span class="layout-template-filters__count">
      共 {{ filteredCount }} / {{ totalCount }} 个
    </span>
  </div>
</template>

<style scoped lang="scss">
.layout-template-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.layout-template-filters__search {
  width: 220px;
}

.layout-template-filters__count {
  margin-left: auto;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 768px) {
  .layout-template-filters__search {
    width: 100%;
  }

  .layout-template-filters__count {
    margin-left: 0;
    width: 100%;
  }
}
</style>
