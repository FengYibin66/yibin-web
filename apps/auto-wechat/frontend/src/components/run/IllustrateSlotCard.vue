<script setup lang="ts">
import { computed } from 'vue'

import { ILLUSTRATION_SOURCE_LABELS } from '@/utils/illustrateOutput'

import type { IllustrationSlot } from '@/types/illustrate'

const props = defineProps<{
  slot: IllustrationSlot
  previewList?: string[]
  loading?: boolean
  actionsDisabled?: boolean
}>()

const emit = defineEmits<{
  'regenerate-auto': []
  'regenerate-ai': []
  ingest: []
  'pick-library': []
}>()

const sourceLabel = computed(() => {
  return ILLUSTRATION_SOURCE_LABELS[props.slot.image.source] ?? props.slot.image.source
})

const sizeLabel = computed(() => {
  const { width, height } = props.slot.image
  if (width && height) {
    return `${width}×${height}`
  }
  return ''
})

const hasPreview = computed(() => {
  return props.slot.status === 'ready' && Boolean(props.slot.image.url)
})

const imagePreviewList = computed(() => {
  if (props.previewList && props.previewList.length > 0) {
    return props.previewList
  }
  if (!props.slot.image.url) {
    return []
  }
  return [props.slot.image.url]
})
</script>

<template>
  <article
    class="illustrate-slot"
    :class="{
      'illustrate-slot--ready': slot.status === 'ready',
      'illustrate-slot--failed': slot.status === 'failed',
    }"
  >
    <div class="illustrate-slot__media">
      <el-image
        v-if="hasPreview"
        :src="slot.image.url"
        :alt="slot.bindTo.headline"
        :preview-src-list="imagePreviewList"
        :initial-index="Math.max(0, imagePreviewList.indexOf(slot.image.url))"
        preview-teleported
        fit="cover"
        class="illustrate-slot__image"
      >
        <template #error>
          <div class="illustrate-slot__placeholder">
            图片加载失败
          </div>
        </template>
      </el-image>

      <div
        v-else-if="slot.status === 'failed'"
        class="illustrate-slot__placeholder illustrate-slot__placeholder--failed"
      >
        <span>配图失败</span>
        <p
          v-if="slot.errorMessage"
          class="illustrate-slot__error"
        >
          {{ slot.errorMessage }}
        </p>
      </div>

      <div
        v-else
        class="illustrate-slot__placeholder"
      >
        待配图
      </div>

      <span class="illustrate-slot__rank">#{{ slot.bindTo.rank }}</span>
    </div>

    <div class="illustrate-slot__body">
      <h3 class="illustrate-slot__headline">
        {{ slot.bindTo.headline }}
      </h3>
      <p class="illustrate-slot__meta">
        <el-tag
          size="small"
          :type="slot.status === 'ready' ? 'success' : slot.status === 'failed' ? 'danger' : 'info'"
        >
          {{ slot.status === 'ready' ? '就绪' : slot.status === 'failed' ? '失败' : '待处理' }}
        </el-tag>
        <span v-if="sourceLabel">{{ sourceLabel }}</span>
        <span v-if="sizeLabel">{{ sizeLabel }}</span>
        <el-tag
          v-if="slot.image.inLibrary"
          size="small"
          type="info"
        >
          已入库
        </el-tag>
      </p>
      <p
        v-if="slot.image.prompt"
        class="illustrate-slot__prompt"
        :title="slot.image.prompt"
      >
        {{ slot.image.prompt }}
      </p>

      <div class="illustrate-slot__actions">
        <el-button
          size="small"
          :loading="loading"
          :disabled="actionsDisabled"
          @click="emit('regenerate-auto')"
        >
          自动换图
        </el-button>
        <el-button
          size="small"
          :loading="loading"
          :disabled="actionsDisabled"
          @click="emit('regenerate-ai')"
        >
          AI 重生
        </el-button>
        <el-button
          v-if="slot.status === 'ready' && !slot.image.inLibrary"
          size="small"
          :loading="loading"
          :disabled="actionsDisabled"
          @click="emit('ingest')"
        >
          加入图库
        </el-button>
        <el-button
          size="small"
          :disabled="actionsDisabled"
          @click="emit('pick-library')"
        >
          从图库选
        </el-button>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.illustrate-slot {
  display: grid;
  grid-template-columns: minmax(200px, 280px) 1fr;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.illustrate-slot--failed {
  border-color: var(--el-color-danger-light-5);
}

.illustrate-slot__media {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.illustrate-slot__image {
  width: 100%;
  height: 100%;
  cursor: zoom-in;
}

.illustrate-slot__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-align: center;
  padding: 12px;
}

.illustrate-slot__placeholder--failed {
  color: var(--el-color-danger);
}

.illustrate-slot__error {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.illustrate-slot__rank {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgb(0 0 0 / 55%);
  color: #fff;
  font-size: 12px;
}

.illustrate-slot__headline {
  margin: 0 0 8px;
  font-size: 15px;
  line-height: 1.45;
}

.illustrate-slot__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.illustrate-slot__prompt {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.illustrate-slot__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
