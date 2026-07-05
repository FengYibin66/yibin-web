<script setup lang="ts">
import { computed } from 'vue'

import HtmlPreview from '@/components/HtmlPreview.vue'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{
  modelValue: string
  mode: 'markdown' | 'html'
  title: string
  subtitle?: string
  placeholder?: string
  badge?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const markdownHtml = computed(() => {
  if (props.mode !== 'markdown') {
    return ''
  }
  return renderMarkdown(props.modelValue)
})

const charCount = computed(() => props.modelValue.length)

function handleInput(value: string): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <section class="split-panel">
    <header class="split-panel__header">
      <div class="split-panel__heading">
        <h3 class="split-panel__title">
          {{ title }}
        </h3>
        <p
          v-if="subtitle"
          class="split-panel__subtitle"
        >
          {{ subtitle }}
        </p>
      </div>
      <el-tag
        v-if="badge"
        type="warning"
        effect="plain"
        size="small"
      >
        {{ badge }}
      </el-tag>
    </header>

    <div class="split-panel__workspace">
      <div class="split-panel__editor">
        <div class="split-panel__pane-head">
          <span>源码</span>
          <span class="split-panel__meta">{{ charCount }} 字符</span>
        </div>
        <el-input
          :model-value="modelValue"
          type="textarea"
          :rows="20"
          :placeholder="placeholder"
          class="split-panel__textarea"
          @update:model-value="handleInput"
        />
      </div>

      <div class="split-panel__preview">
        <div class="split-panel__pane-head">
          <span>实时预览</span>
        </div>
        <div
          v-if="mode === 'markdown'"
          class="split-panel__preview-body split-panel__preview-body--md"
        >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <article
            class="markdown-body"
            v-html="markdownHtml"
          />
        </div>
        <div
          v-else
          class="split-panel__preview-body split-panel__preview-body--html"
        >
          <div class="phone-frame">
            <div class="phone-frame__bar" />
            <div class="phone-frame__screen">
              <HtmlPreview
                :html="modelValue"
                :title="`${title} 预览`"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.split-panel {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
  overflow: hidden;
}

.split-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.split-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.split-panel__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.split-panel__workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 480px;
}

.split-panel__editor,
.split-panel__preview {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.split-panel__editor {
  border-right: 1px solid var(--el-border-color-lighter);
  background: #1e1e1e;
}

.split-panel__preview {
  background: #f5f6f8;
}

.split-panel__pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.split-panel__editor .split-panel__pane-head {
  color: #aaa;
  border-bottom-color: #333;
  background: #252526;
}

.split-panel__meta {
  font-weight: 400;
  text-transform: none;
  opacity: 0.8;
}

.split-panel__textarea {
  flex: 1;

  :deep(textarea) {
    min-height: 440px;
    height: 100% !important;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    line-height: 1.65;
    resize: none;
  }

  :deep(.el-textarea__inner:focus) {
    box-shadow: none;
  }
}

.split-panel__preview-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.split-panel__preview-body--md {
  background: #fff;
}

.split-panel__preview-body--html {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px 16px;
}

.phone-frame {
  width: 100%;
  max-width: 390px;
  border-radius: 24px;
  border: 1px solid #ddd;
  background: #fff;
  box-shadow: 0 8px 32px rgb(0 0 0 / 8%);
  overflow: hidden;
}

.phone-frame__bar {
  height: 28px;
  background: linear-gradient(180deg, #f0f0f0, #e8e8e8);
}

.phone-frame__screen {
  :deep(.html-preview) {
    border: none;
    border-radius: 0;
  }

  :deep(.html-preview__frame) {
    min-height: 520px;
  }
}

.markdown-body {
  font-size: 16px;
  line-height: 1.75;
  color: #333;
  word-break: break-word;

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin: 16px 0 8px;
    font-weight: 700;
    color: #1a1a1a;
  }

  :deep(p) {
    margin: 8px 0;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 20px;
    margin: 8px 0;
  }

  :deep(a) {
    color: #576b95;
  }

  :deep(blockquote) {
    margin: 12px 0;
    padding-left: 12px;
    border-left: 3px solid #e0e0e0;
    color: #666;
  }

  :deep(code) {
    background: #f5f5f5;
    padding: 2px 4px;
    border-radius: 4px;
  }

  :deep(pre) {
    background: #f5f5f5;
    padding: 12px;
    border-radius: 6px;
    overflow: auto;
  }
}

@media (max-width: 1100px) {
  .split-panel__workspace {
    grid-template-columns: 1fr;
  }

  .split-panel__editor {
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .split-panel__textarea :deep(textarea) {
    min-height: 280px;
  }
}
</style>
