<script setup lang="ts">
import type { ImageAsset } from '@/types/imageAsset'

defineProps<{
  visible: boolean
  loading?: boolean
  assets: ImageAsset[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [asset: ImageAsset]
}>()

function previewList(asset: ImageAsset): string[] {
  return [asset.url]
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="从图片库选择"
    width="820px"
    @update:model-value="emit('update:visible', $event)"
  >
    <p class="illustrate-library-picker__hint">
      点击缩略图可放大预览，确认后点「选用」替换当前槽位配图。
    </p>
    <div
      v-loading="loading"
      class="illustrate-library-picker__grid"
    >
      <article
        v-for="asset in assets"
        :key="asset.id"
        class="illustrate-library-picker__item"
      >
        <el-image
          :src="asset.url"
          :alt="asset.name"
          :preview-src-list="previewList(asset)"
          preview-teleported
          fit="cover"
          class="illustrate-library-picker__image"
        />
        <div class="illustrate-library-picker__info">
          <span
            class="illustrate-library-picker__name"
            :title="asset.name"
          >{{ asset.name }}</span>
          <el-button
            type="primary"
            size="small"
            @click="emit('select', asset)"
          >
            选用
          </el-button>
        </div>
      </article>
      <el-empty
        v-if="!loading && assets.length === 0"
        description="图片库为空"
      />
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.illustrate-library-picker__hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.illustrate-library-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  min-height: 160px;
}

.illustrate-library-picker__item {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-bg-color);
}

.illustrate-library-picker__image {
  width: 100%;
  aspect-ratio: 16 / 9;
  cursor: zoom-in;
}

.illustrate-library-picker__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
}

.illustrate-library-picker__name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
