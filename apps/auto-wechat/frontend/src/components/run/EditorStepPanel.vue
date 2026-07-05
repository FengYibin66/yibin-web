<script setup lang="ts">
import { computed } from 'vue'

import type { RunArtifacts, StepDetailArtifact } from '@/types/artifacts'
import { resolveEditorOutput } from '@/utils/editorOutput'

const props = defineProps<{
  stepDetail: StepDetailArtifact | null
  artifacts: RunArtifacts | null
  isRegenerating?: boolean
}>()

const parsed = computed(() => resolveEditorOutput(props.stepDetail, props.artifacts))

const sectionCount = computed(() => {
  if (!parsed.value) {
    return 0
  }
  return parsed.value.outline.filter((entry) => entry.heading !== '导语').length
})

const digestCount = computed(() => props.artifacts?.digest?.items.length ?? 0)

const outlineHint = computed(() => {
  if (!parsed.value) {
    return ''
  }
  const selected = parsed.value.selectedUrls.length
  const sections = sectionCount.value
  if (digestCount.value > 0) {
    return `从 Digest ${digestCount.value} 条中精选 ${selected} 条，分为 ${sections} 个内容板块`
  }
  return `精选 ${selected} 条，分为 ${sections} 个内容板块`
})
</script>

<template>
  <div class="editor-panel">
    <el-empty
      v-if="isRegenerating"
      description="正在根据 Digest 与标签生成选题大纲…"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'pending'"
      description="等待执行，需先完成富化"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'running'"
      description="主编 Agent 正在按标签聚类并确定今日选题…"
    />

    <template v-else-if="parsed">
      <el-alert
        v-if="sectionCount < 2"
        type="warning"
        show-icon
        :closable="false"
        title="内容板块偏少"
        class="editor-panel__alert"
      >
        <template #default>
          当前仅 {{ sectionCount }} 个板块（除导语外）。可能是 Digest 标签不全或过于集中，建议在富化阶段补全标签后重新生成选题。
        </template>
      </el-alert>

      <el-descriptions
        :column="1"
        border
        class="editor-panel__desc"
      >
        <el-descriptions-item label="选题">
          {{ parsed.topic }}
        </el-descriptions-item>
        <el-descriptions-item
          v-if="parsed.angle"
          label="角度"
        >
          {{ parsed.angle }}
        </el-descriptions-item>
      </el-descriptions>

      <section class="editor-panel__outline">
        <h3 class="editor-panel__section-title">
          分板块大纲
        </h3>
        <p class="editor-panel__outline-hint">
          {{ outlineHint }} · 按 Digest 标签聚类，驱动下一步写作小节
        </p>
        <div class="editor-panel__outline-list">
          <article
            v-for="(entry, index) in parsed.outline"
            :key="`${entry.heading}-${index}`"
            class="editor-panel__outline-item"
          >
            <div class="editor-panel__outline-head">
              <span class="editor-panel__outline-index">{{ index + 1 }}</span>
              <span class="editor-panel__outline-heading">{{ entry.heading }}</span>
              <el-tag
                v-if="entry.tag"
                size="small"
                type="info"
                effect="plain"
              >
                {{ entry.tag }}
              </el-tag>
            </div>
            <ul
              v-if="entry.bullets.length"
              class="editor-panel__bullets"
            >
              <li
                v-for="(bullet, bulletIndex) in entry.bullets"
                :key="bulletIndex"
              >
                {{ bullet }}
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section
        v-if="parsed.selectedUrls.length"
        class="editor-panel__urls"
      >
        <h3 class="editor-panel__section-title">
          入选链接
        </h3>
        <ul class="editor-panel__url-list">
          <li
            v-for="url in parsed.selectedUrls"
            :key="url"
          >
            <a
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
            >{{ url }}</a>
          </li>
        </ul>
      </section>

      <section class="editor-panel__notes">
        <h3 class="editor-panel__section-title">
          说明
        </h3>
        <ul class="editor-panel__note-list">
          <li>大纲板块与富化阶段的 <code>tags</code> 对齐，驱动写作分节</li>
          <li>下一步「写作」将按此大纲生成带 <code>## 板块</code> 的正文</li>
        </ul>
      </section>
    </template>

    <el-empty
      v-else-if="stepDetail?.status === 'succeeded'"
      description="选题已完成，但暂无结构化输出"
    />

    <details
      v-if="stepDetail?.output && !isRegenerating"
      class="editor-panel__raw"
    >
      <summary>原始 JSON</summary>
      <pre class="editor-panel__json">{{ JSON.stringify(stepDetail.output, null, 2) }}</pre>
    </details>
  </div>
</template>

<style scoped lang="scss">
.editor-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-panel__alert {
  margin: 0;
}

.editor-panel__outline-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.editor-panel__section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.editor-panel__section-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.editor-panel__outline-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.editor-panel__outline-item {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.editor-panel__outline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.editor-panel__outline-index {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--el-fill-color);
  font-size: 12px;
  font-weight: 600;
}

.editor-panel__outline-heading {
  font-size: 15px;
  font-weight: 600;
}

.editor-panel__bullets {
  margin: 10px 0 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.editor-panel__url-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  word-break: break-all;

  a {
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.editor-panel__notes {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.editor-panel__note-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;

  code {
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--el-fill-color);
  }
}

.editor-panel__raw {
  font-size: 12px;
  color: var(--el-text-color-secondary);

  summary {
    cursor: pointer;
    user-select: none;
  }
}

.editor-panel__json {
  margin: 8px 0 0;
  padding: 14px;
  border-radius: 8px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
  max-height: 320px;
}

</style>
