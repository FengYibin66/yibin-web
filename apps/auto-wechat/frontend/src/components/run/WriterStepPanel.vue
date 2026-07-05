<script setup lang="ts">
import { computed } from 'vue'

import SplitCodePreview from '@/components/SplitCodePreview.vue'
import type { RunArtifacts, StepDetailArtifact } from '@/types/artifacts'
import type { WriterDraftFields } from '@/types/writer'
import {
  countMarkdownSections,
  estimateWordCount,
  resolveWriterOutput,
} from '@/utils/writerOutput'

const props = defineProps<{
  draft: WriterDraftFields
  stepDetail: StepDetailArtifact | null
  artifacts: RunArtifacts | null
  isRegenerating?: boolean
}>()

const writerOutput = computed(() => resolveWriterOutput(props.stepDetail, props.artifacts))

const sectionCount = computed(() => countMarkdownSections(props.draft.bodyMarkdown))
const wordCount = computed(() => estimateWordCount(props.draft.bodyMarkdown))
const sourceCount = computed(() => writerOutput.value?.sources.length ?? 0)

const contentHint = computed(() => {
  const parts = [`约 ${wordCount.value} 字`]
  if (sectionCount.value > 0) {
    parts.push(`${sectionCount.value} 个正文小节`)
  }
  if (sourceCount.value > 0) {
    parts.push(`${sourceCount.value} 个引用来源`)
  }
  return parts.join(' · ')
})

const titleCandidates = computed(() => {
  const candidates = writerOutput.value?.titleCandidates ?? []
  return candidates.filter((item) => item.trim() && item !== props.draft.title)
})

const showShortBodyWarning = computed(() => {
  return props.draft.bodyMarkdown.trim().length > 0 && wordCount.value < 500
})

const showFewSectionsWarning = computed(() => {
  return props.draft.bodyMarkdown.trim().length > 0 && sectionCount.value < 2
})

function applyTitle(candidate: string): void {
  props.draft.title = candidate
}
</script>

<template>
  <div class="writer-panel">
    <el-empty
      v-if="isRegenerating"
      description="正在根据选题大纲撰写正文…"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'pending'"
      description="等待执行，需先完成选题"
    />

    <el-empty
      v-else-if="stepDetail?.status === 'running'"
      description="撰稿 Agent 正在生成 Markdown 正文…"
    />

    <template v-else-if="draft.bodyMarkdown || draft.title || writerOutput">
      <p class="writer-panel__hint">
        {{ contentHint || '编辑标题、导语与正文后，点击右上角「保存成稿」' }}
      </p>

      <el-alert
        v-if="showShortBodyWarning"
        type="warning"
        show-icon
        :closable="false"
        title="正文偏短"
        description="当前不足 500 字，建议补充素材或重新生成写作。"
        class="writer-panel__alert"
      />

      <el-alert
        v-if="showFewSectionsWarning"
        type="info"
        show-icon
        :closable="false"
        title="正文小节较少"
        description="未发现多个 ## 小节。若选题已分板块，可检查写作是否按标签分节，或重新生成。"
        class="writer-panel__alert"
      />

      <section
        v-if="titleCandidates.length"
        class="writer-panel__candidates"
      >
        <span class="writer-panel__candidates-label">标题备选</span>
        <div class="writer-panel__candidates-list">
          <el-button
            v-for="candidate in titleCandidates"
            :key="candidate"
            size="small"
            round
            @click="applyTitle(candidate)"
          >
            {{ candidate }}
          </el-button>
        </div>
      </section>

      <el-form
        label-position="top"
        class="writer-panel__form"
      >
        <el-form-item label="标题">
          <el-input
            v-model="draft.title"
            maxlength="64"
            show-word-limit
            placeholder="公众号文章标题"
          />
        </el-form-item>
        <el-form-item label="导语">
          <el-input
            v-model="draft.summary"
            type="textarea"
            :rows="2"
            maxlength="120"
            show-word-limit
            placeholder="100 字内导读，显示在文章开头"
          />
        </el-form-item>
      </el-form>

      <SplitCodePreview
        v-model="draft.bodyMarkdown"
        mode="markdown"
        title="Markdown 正文"
        subtitle="左侧编辑、右侧预览；将用于排版与发布"
        placeholder="Writer 输出的 Markdown"
      />

      <section
        v-if="writerOutput?.sources.length"
        class="writer-panel__sources"
      >
        <h3 class="writer-panel__section-title">
          引用来源
        </h3>
        <ul class="writer-panel__source-list">
          <li
            v-for="source in writerOutput.sources"
            :key="source.url"
          >
            <a
              :href="source.url"
              target="_blank"
              rel="noopener noreferrer"
            >{{ source.name || source.url }}</a>
          </li>
        </ul>
      </section>
    </template>

    <el-empty
      v-else
      description="写作尚未完成，请先跑通上游或重新生成此节点"
    />

    <details
      v-if="stepDetail?.output && !isRegenerating"
      class="writer-panel__raw"
    >
      <summary>原始 JSON</summary>
      <pre class="writer-panel__json">{{ JSON.stringify(stepDetail.output, null, 2) }}</pre>
    </details>
  </div>
</template>

<style scoped lang="scss">
.writer-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.writer-panel__hint {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.writer-panel__alert {
  margin: 0;
}

.writer-panel__candidates {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.writer-panel__candidates-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.writer-panel__candidates-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.writer-panel__form {
  max-width: 720px;
}

.writer-panel__section-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.writer-panel__source-list {
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

.writer-panel__raw {
  font-size: 12px;
  color: var(--el-text-color-secondary);

  summary {
    cursor: pointer;
    user-select: none;
  }
}

.writer-panel__json {
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
