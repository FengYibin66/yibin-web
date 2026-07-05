<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  createWeChatPreviewSession,
  wechatPreviewQrImageUrl,
} from '@/api/wechatPreview'

import type { CreateWeChatPreviewPayload } from '@/api/wechatPreview'

const props = defineProps<{
  payload: CreateWeChatPreviewPayload
}>()

const visible = defineModel<boolean>('visible', { default: false })

const loading = ref(false)
const session = ref<Awaited<ReturnType<typeof createWeChatPreviewSession>> | null>(null)

const qrUrl = computed(() => {
  if (!session.value?.previewUrl) {
    return ''
  }
  return wechatPreviewQrImageUrl(session.value.previewUrl)
})

const expiresLabel = computed(() => {
  const seconds = session.value?.expiresIn ?? 0
  if (seconds <= 0) {
    return ''
  }
  const minutes = Math.round(seconds / 60)
  return `约 ${minutes} 分钟内有效`
})

async function openSession(): Promise<void> {
  loading.value = true
  session.value = null
  try {
    session.value = await createWeChatPreviewSession(props.payload)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '生成预览链接失败')
    visible.value = false
  } finally {
    loading.value = false
  }
}

async function copyLink(): Promise<void> {
  if (!session.value?.previewUrl) {
    return
  }
  try {
    await navigator.clipboard.writeText(session.value.previewUrl)
    ElMessage.success('链接已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择链接')
  }
}

function handleOpen(): void {
  void openSession()
}

function handleClosed(): void {
  session.value = null
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="微信扫码预览"
    width="420px"
    destroy-on-close
    @open="handleOpen"
    @closed="handleClosed"
  >
    <div
      v-loading="loading"
      class="wechat-scan-preview"
    >
      <p class="wechat-scan-preview__intro">
        使用微信「扫一扫」打开下方链接，在真机微信内置浏览器中验收 SVG 交互（X5 内核）。
      </p>

      <el-alert
        v-if="session?.localOnly"
        type="warning"
        :closable="false"
        show-icon
        title="当前为本地地址，微信无法直接访问"
        :description="session.localHint"
        class="wechat-scan-preview__alert"
      />

      <template v-if="session">
        <div class="wechat-scan-preview__qr-wrap">
          <img
            v-if="qrUrl"
            :src="qrUrl"
            alt="微信扫码预览二维码"
            class="wechat-scan-preview__qr"
            width="220"
            height="220"
          >
        </div>

        <p
          v-if="expiresLabel"
          class="wechat-scan-preview__meta"
        >
          {{ expiresLabel }}
        </p>

        <el-input
          :model-value="session.previewUrl"
          readonly
          class="wechat-scan-preview__url"
        >
          <template #append>
            <el-button @click="copyLink">
              复制
            </el-button>
          </template>
        </el-input>
      </template>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.wechat-scan-preview__intro {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.wechat-scan-preview__alert {
  margin-bottom: 16px;
}

.wechat-scan-preview__qr-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.wechat-scan-preview__qr {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: #fff;
}

.wechat-scan-preview__meta {
  margin: 0 0 12px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.wechat-scan-preview__url {
  width: 100%;
}
</style>
