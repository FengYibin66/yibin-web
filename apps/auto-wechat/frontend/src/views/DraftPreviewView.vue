<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getPipelineRun } from '@/api/pipeline'
import HtmlPreview from '@/components/HtmlPreview.vue'
import WeChatScanPreviewDialog from '@/components/layout/WeChatScanPreviewDialog.vue'
import { ROUTE_NAMES } from '@/constants/routes'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const runData = ref<Awaited<ReturnType<typeof getPipelineRun>> | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const previewHtml = computed(() => runData.value?.previewHtml ?? '')
const wechatPreviewVisible = ref(false)

async function fetchRun(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    runData.value = await getPipelineRun(props.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function handleBack(): void {
  void router.push({ name: ROUTE_NAMES.RUN_DETAIL, params: { id: props.id } })
}

onMounted(() => {
  void fetchRun()
})
</script>

<template>
  <section
    v-loading="loading"
    class="draft-preview"
  >
    <el-page-header @back="handleBack">
      <template #content>
        <span>成稿预览</span>
      </template>
    </el-page-header>

    <el-result
      v-if="error"
      icon="error"
      title="加载失败"
      :sub-title="error"
    />

    <template v-else-if="previewHtml">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="预览说明"
        description="下方为浏览器近似预览。SVG 交互请用「微信扫码预览」在真机验收；发表请前往 mp.weixin.qq.com 草稿箱。"
        class="preview-alert"
      />
      <div class="draft-preview__toolbar">
        <el-button
          type="primary"
          @click="wechatPreviewVisible = true"
        >
          微信扫码预览
        </el-button>
      </div>
      <HtmlPreview
        :html="previewHtml"
        title="微信成稿预览"
      />
      <WeChatScanPreviewDialog
        v-model:visible="wechatPreviewVisible"
        :payload="{ runId: props.id }"
      />
    </template>

    <el-empty
      v-else-if="!loading"
      description="暂无成稿内容"
    />
  </section>
</template>

<style scoped lang="scss">
.draft-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-alert {
  margin-top: 16px;
}

.draft-preview__toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
