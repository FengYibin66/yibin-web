<script setup lang="ts">
import { onMounted } from 'vue'

import LayoutTemplateCard from '@/components/layout/LayoutTemplateCard.vue'
import LayoutTemplateFilters from '@/components/layout/LayoutTemplateFilters.vue'
import LayoutTemplateImportDialog from '@/components/layout/LayoutTemplateImportDialog.vue'
import LayoutTemplatePreviewAside from '@/components/layout/LayoutTemplatePreviewAside.vue'
import { useLayoutTemplateLibrary } from '@/composables/useLayoutTemplateLibrary'

const {
  loading,
  templates,
  selectedId,
  previewDetail,
  previewLoading,
  keyword,
  filterArticleType,
  filterSvg,
  filterFeatured,
  filterTag,
  importVisible,
  importSaving,
  filteredTemplates,
  allTags,
  selectedSummary,
  fetchTemplates,
  handleSelect,
  handleViewDetail,
  handleDelete,
  handleImport,
  handleSetDefault,
} = useLayoutTemplateLibrary()

onMounted(() => {
  void fetchTemplates()
})
</script>

<template>
  <section
    v-loading="loading"
    class="template-library"
  >
    <header class="template-library__head">
      <div>
        <h1 class="template-library__title">
          排版模板库
        </h1>
        <p class="template-library__subtitle">
          运营精选的微信 HTML 版式。可设全局默认（新建 Run 自动复制）；无任务模板时 Pipeline 会 Top3 匹配 few-shot 仿写。
        </p>
      </div>
      <el-button
        type="primary"
        @click="importVisible = true"
      >
        导入 HTML 模板
      </el-button>
    </header>

    <LayoutTemplateFilters
      v-model:keyword="keyword"
      v-model:filter-article-type="filterArticleType"
      v-model:filter-svg="filterSvg"
      v-model:filter-featured="filterFeatured"
      v-model:filter-tag="filterTag"
      :all-tags="allTags"
      :filtered-count="filteredTemplates.length"
      :total-count="templates.length"
    />

    <el-empty
      v-if="!loading && templates.length === 0"
      description="模板库为空，请先跑一期 Pipeline 或导入 HTML"
    />

    <div
      v-else
      class="template-library__workspace"
    >
      <div class="template-library__grid">
        <LayoutTemplateCard
          v-for="item in filteredTemplates"
          :key="item.id"
          :template="item"
          :active="item.id === selectedId"
          @select="handleSelect(item.id)"
          @view="handleViewDetail(item.id)"
          @delete="handleDelete(item)"
          @set-default="handleSetDefault(item)"
        />
        <el-empty
          v-if="!loading && filteredTemplates.length === 0"
          description="无匹配模板，请调整筛选"
          class="template-library__empty-filter"
        />
      </div>

      <LayoutTemplatePreviewAside
        v-if="selectedSummary"
        :summary="selectedSummary"
        :detail="previewDetail"
        :loading="previewLoading"
        @view-detail="handleViewDetail(selectedSummary.id)"
      />
    </div>

    <LayoutTemplateImportDialog
      v-model:visible="importVisible"
      :saving="importSaving"
      @submit="handleImport"
    />
  </section>
</template>

<style scoped lang="scss">
.template-library {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.template-library__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.template-library__title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
}

.template-library__subtitle {
  margin: 0;
  max-width: 640px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.template-library__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  gap: 24px;
  align-items: start;
}

.template-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.template-library__empty-filter {
  grid-column: 1 / -1;
}

@media (max-width: 1024px) {
  .template-library__workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .app-main {
    padding: 16px;
  }
}
</style>
