<script setup lang="ts">
import { onMounted } from 'vue'

import { useImageLibrary } from '@/composables/useImageLibrary'
import { ILLUSTRATION_SOURCE_LABELS } from '@/utils/illustrateOutput'

const {
  loading,
  keyword,
  filterSource,
  filteredAssets,
  fetchAssets,
  handleDelete,
} = useImageLibrary()

onMounted(() => {
  void fetchAssets()
})

function sourceLabel(source: string): string {
  return ILLUSTRATION_SOURCE_LABELS[source] ?? source
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}
</script>

<template>
  <section
    v-loading="loading"
    class="image-library"
  >
    <header class="image-library__head">
      <div>
        <h1 class="image-library__title">
          图片库
        </h1>
        <p class="image-library__subtitle">
          AI 生成默认自动入库；RSS/抓取配图可在 Run 配图步骤手动「加入图片库」。
        </p>
      </div>
      <el-button
        type="primary"
        @click="fetchAssets"
      >
        刷新
      </el-button>
    </header>

    <div class="image-library__filters">
      <el-input
        v-model="keyword"
        placeholder="搜索名称或来源 URL"
        clearable
        @change="fetchAssets"
      />
      <el-select
        v-model="filterSource"
        placeholder="来源"
        clearable
        @change="fetchAssets"
      >
        <el-option
          label="AI 生成"
          value="generated"
        />
        <el-option
          label="上传"
          value="upload"
        />
        <el-option
          label="RSS"
          value="rss"
        />
        <el-option
          label="抓取"
          value="scraped"
        />
      </el-select>
    </div>

    <div class="image-library__grid">
      <article
        v-for="asset in filteredAssets"
        :key="asset.id"
        class="image-library__card"
      >
        <el-image
          :src="asset.url"
          :alt="asset.name"
          :preview-src-list="[asset.url]"
          preview-teleported
          fit="cover"
          class="image-library__preview"
          loading="lazy"
        />
        <div class="image-library__card-body">
          <h3>{{ asset.name }}</h3>
          <p>
            {{ sourceLabel(asset.source) }}
            · {{ formatSize(asset.byteSize) }}
            · 引用 {{ asset.usageCount }}
          </p>
          <div class="image-library__card-actions">
            <el-tag
              v-if="asset.autoIngested"
              size="small"
              type="info"
            >
              自动入库
            </el-tag>
            <el-button
              link
              type="danger"
              @click="handleDelete(asset)"
            >
              删除
            </el-button>
          </div>
        </div>
      </article>
      <el-empty
        v-if="!loading && filteredAssets.length === 0"
        description="暂无图片"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.image-library__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.image-library__title {
  margin: 0 0 8px;
}

.image-library__subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.image-library__filters {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 12px;
  margin-bottom: 20px;
}

.image-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.image-library__card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-bg-color);

}

.image-library__preview {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  cursor: zoom-in;
}

.image-library__card-body {
  padding: 12px;

  h3 {
    margin: 0 0 6px;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.image-library__card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
