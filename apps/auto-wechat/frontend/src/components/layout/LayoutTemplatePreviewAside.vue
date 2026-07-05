<script setup lang="ts">
import { ref } from 'vue'

import PhonePreviewFrame from '@/components/layout/PhonePreviewFrame.vue'
import WeChatScanPreviewDialog from '@/components/layout/WeChatScanPreviewDialog.vue'

import type { LayoutTemplateDetail, LayoutTemplateSummary } from '@/types/layoutTemplate'

defineProps<{
  summary: LayoutTemplateSummary
  detail: LayoutTemplateDetail | null
  loading: boolean
}>()

const wechatPreviewVisible = ref(false)

const emit = defineEmits<{
  viewDetail: []
}>()
</script>

<template>
  <aside class="layout-template-preview">
    <div class="layout-template-preview__head">
      <div>
        <h2 class="layout-template-preview__title">
          {{ summary.name }}
        </h2>
        <p
          v-if="summary.description"
          class="layout-template-preview__desc"
        >
          {{ summary.description }}
        </p>
      </div>
      <div class="layout-template-preview__actions">
        <el-button
          type="success"
          link
          :disabled="!detail?.bodyHtml"
          @click="wechatPreviewVisible = true"
        >
          微信预览
        </el-button>
        <el-button
          type="primary"
          link
          @click="emit('viewDetail')"
        >
          全屏详情
        </el-button>
      </div>
    </div>

    <div
      v-loading="loading"
      class="layout-template-preview__body"
    >
      <PhonePreviewFrame
        v-if="detail?.bodyHtml"
        :html="detail.bodyHtml"
        :title="summary.name"
      />
      <el-empty
        v-else-if="!loading"
        description="预览加载失败"
      />
    </div>

    <WeChatScanPreviewDialog
      v-if="detail"
      v-model:visible="wechatPreviewVisible"
      :payload="{ layoutTemplateId: detail.id, title: summary.name }"
    />
  </aside>
</template>

<style scoped lang="scss">
.layout-template-preview {
  position: sticky;
  top: 16px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
}

.layout-template-preview__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.layout-template-preview__title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.layout-template-preview__desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.layout-template-preview__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

@media (max-width: 1024px) {
  .layout-template-preview {
    position: static;
  }
}
</style>
