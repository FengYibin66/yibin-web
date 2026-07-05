<script setup lang="ts">
import { ref, watch } from 'vue'

import { LAYOUT_TEMPLATE_TAG_SUGGESTIONS } from '@/constants/layoutTemplate'

import type { CreateLayoutTemplatePayload } from '@/types/layoutTemplate'

const props = defineProps<{
  visible: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [payload: CreateLayoutTemplatePayload]
}>()

const form = ref({
  name: '',
  description: '',
  articleType: 'daily_digest',
  tags: [] as string[],
  bodyHtml: '',
})

function resetForm(): void {
  form.value = {
    name: '',
    description: '',
    articleType: 'daily_digest',
    tags: [],
    bodyHtml: '',
  }
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      resetForm()
    }
  },
)

function handleSubmit(): void {
  if (!form.value.name.trim() || !form.value.bodyHtml.trim()) {
    return
  }
  emit('submit', {
    name: form.value.name.trim(),
    description: form.value.description.trim() || undefined,
    articleType: form.value.articleType,
    tags: form.value.tags,
    bodyHtml: form.value.bodyHtml.trim(),
  })
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="导入 HTML 模板"
    width="640px"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-position="top">
      <el-form-item
        label="模板名称"
        required
      >
        <el-input
          v-model="form.name"
          maxlength="64"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="说明">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
        />
      </el-form-item>
      <el-form-item label="标签">
        <el-select
          v-model="form.tags"
          multiple
          filterable
          allow-create
          style="width: 100%"
        >
          <el-option
            v-for="tag in LAYOUT_TEMPLATE_TAG_SUGGESTIONS"
            :key="tag"
            :label="tag"
            :value="tag"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        label="bodyHtml"
        required
      >
        <el-input
          v-model="form.bodyHtml"
          type="textarea"
          :rows="12"
          placeholder="粘贴微信公众号兼容的完整 HTML"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:visible', false)">
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!form.name.trim() || !form.bodyHtml.trim()"
        @click="handleSubmit"
      >
        导入
      </el-button>
    </template>
  </el-dialog>
</template>
