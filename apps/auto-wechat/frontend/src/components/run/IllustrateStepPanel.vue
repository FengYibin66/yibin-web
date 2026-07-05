<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  assignLibraryAssetToSlot,
  ingestIllustrationSlot,
  regenerateIllustrationSlot,
} from '@/api/illustrate'
import { listImageAssets } from '@/api/imageAssets'
import IllustrateLibraryPicker from '@/components/run/IllustrateLibraryPicker.vue'
import IllustrateSlotCard from '@/components/run/IllustrateSlotCard.vue'
import { parseIllustrateStepOutput } from '@/utils/illustrateOutput'

import type { StepDetailArtifact } from '@/types/artifacts'
import type { IllustrationSlot } from '@/types/illustrate'
import type { ImageAsset } from '@/types/imageAsset'

const props = defineProps<{
  runId: string
  stepDetail: StepDetailArtifact | null
  isRegenerating?: boolean
}>()

const emit = defineEmits<{
  refreshed: []
}>()

const loadingSlotId = ref<string | null>(null)
const libraryVisible = ref(false)
const libraryLoading = ref(false)
const libraryAssets = ref<ImageAsset[]>([])
const libraryTargetSlotId = ref('')

const illustration = computed(() => parseIllustrateStepOutput(props.stepDetail))

const readyCount = computed(() => illustration.value?.stats.ready ?? 0)
const totalCount = computed(() => illustration.value?.stats.total ?? 0)

const previewUrls = computed(() => {
  if (!illustration.value) {
    return []
  }
  return illustration.value.slots
    .filter((slot) => slot.status === 'ready' && slot.image.url)
    .map((slot) => slot.image.url)
})

function isSlotLoading(slotId: string): boolean {
  return loadingSlotId.value === slotId
}

function isActionsDisabled(slotId: string): boolean {
  return Boolean(loadingSlotId.value && loadingSlotId.value !== slotId)
}

async function withSlotLoading<T>(slotId: string, task: () => Promise<T>): Promise<T> {
  loadingSlotId.value = slotId
  try {
    return await task()
  } finally {
    loadingSlotId.value = null
  }
}

async function handleRegenerate(slot: IllustrationSlot, mode: 'auto' | 'ai'): Promise<void> {
  await withSlotLoading(slot.id, async () => {
    await regenerateIllustrationSlot(props.runId, slot.id, mode)
    ElMessage.success('已重新配图')
    emit('refreshed')
  })
}

async function handleIngest(slot: IllustrationSlot): Promise<void> {
  await withSlotLoading(slot.id, async () => {
    await ingestIllustrationSlot(props.runId, slot.id)
    ElMessage.success('已加入图片库')
    emit('refreshed')
  })
}

async function openLibraryPicker(slot: IllustrationSlot): Promise<void> {
  libraryTargetSlotId.value = slot.id
  libraryVisible.value = true
  libraryLoading.value = true
  try {
    libraryAssets.value = await listImageAssets()
  } finally {
    libraryLoading.value = false
  }
}

async function handlePickAsset(asset: ImageAsset): Promise<void> {
  if (!libraryTargetSlotId.value) {
    return
  }
  await withSlotLoading(libraryTargetSlotId.value, async () => {
    await assignLibraryAssetToSlot(props.runId, libraryTargetSlotId.value, asset.id)
    libraryVisible.value = false
    ElMessage.success('已从图片库换图')
    emit('refreshed')
  })
}

async function confirmRegenerateAi(slot: IllustrationSlot): Promise<void> {
  await ElMessageBox.confirm('将调用 AI 重新生成该条配图，可能产生额外费用。', 'AI 重生配图', {
    type: 'warning',
    confirmButtonText: '继续',
    cancelButtonText: '取消',
  })
  await handleRegenerate(slot, 'ai')
}
</script>

<template>
  <section class="illustrate-panel">
    <el-empty
      v-if="isRegenerating"
      description="正在重新生成配图…"
    />

    <template v-else-if="illustration">
      <header class="illustrate-panel__summary">
        <div class="illustrate-panel__stats">
          <el-tag type="success">
            就绪 {{ readyCount }} / {{ totalCount }}
          </el-tag>
          <span
            v-if="previewUrls.length > 0"
            class="illustrate-panel__preview-tip"
          >
            点击配图可放大预览
          </span>
        </div>
        <p class="illustrate-panel__hint">
          每条资讯对应一张配图。换图后请从「排版」重新生成，才能把新图写入正文 HTML。
        </p>
      </header>

      <div class="illustrate-panel__list">
        <IllustrateSlotCard
          v-for="slot in illustration.slots"
          :key="slot.id"
          :slot="slot"
          :preview-list="previewUrls"
          :loading="isSlotLoading(slot.id)"
          :actions-disabled="isActionsDisabled(slot.id)"
          @regenerate-auto="handleRegenerate(slot, 'auto')"
          @regenerate-ai="confirmRegenerateAi(slot)"
          @ingest="handleIngest(slot)"
          @pick-library="openLibraryPicker(slot)"
        />
      </div>
    </template>

    <el-empty
      v-else
      description="暂无配图输出"
    />

    <IllustrateLibraryPicker
      v-model:visible="libraryVisible"
      :loading="libraryLoading"
      :assets="libraryAssets"
      @select="handlePickAsset"
    />
  </section>
</template>

<style scoped lang="scss">
.illustrate-panel__summary {
  margin-bottom: 16px;
}

.illustrate-panel__stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.illustrate-panel__preview-tip {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.illustrate-panel__hint {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.illustrate-panel__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
