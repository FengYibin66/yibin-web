<script setup lang="ts">
import { articleTypeLabel, itemCountLabel } from '@/utils/layoutOutput'

import type { LayoutTemplateSummary } from '@/types/layoutTemplate'

defineProps<{
  template: LayoutTemplateSummary
  active?: boolean
}>()

const emit = defineEmits<{
  select: []
  view: []
  delete: []
  setDefault: []
}>()
</script>

<template>
  <article
    class="template-card"
    :class="{ 'template-card--active': active, 'template-card--featured': template.isFeatured, 'template-card--default': template.isDefault }"
    @click="emit('select')"
  >
    <div class="template-card__visual">
      <div
        class="template-card__gradient"
        :class="{ 'template-card__gradient--svg': template.hasSvg }"
      >
        <span
          v-if="template.isDefault"
          class="template-card__badge template-card__badge--default"
        >默认</span>
        <span
          v-else-if="template.isFeatured"
          class="template-card__badge"
        >精选</span>
        <span
          v-if="template.hasSvg"
          class="template-card__svg-tag"
        >SVG 交互</span>
        <p class="template-card__visual-title">
          {{ template.name }}
        </p>
      </div>
    </div>

    <div class="template-card__body">
      <p
        v-if="template.description"
        class="template-card__desc"
      >
        {{ template.description }}
      </p>

      <div class="template-card__meta">
        <el-tag
          size="small"
          effect="plain"
        >
          {{ articleTypeLabel(template.articleType) }}
        </el-tag>
        <el-tag
          size="small"
          type="info"
          effect="plain"
        >
          {{ itemCountLabel(template.itemCountMin, template.itemCountMax) }}
        </el-tag>
        <el-tag
          v-if="template.qualityScore"
          size="small"
          type="success"
          effect="plain"
        >
          {{ template.qualityScore }} 分
        </el-tag>
      </div>

      <div
        v-if="template.tags?.length"
        class="template-card__tags"
      >
        <el-tag
          v-for="tag in template.tags.slice(0, 4)"
          :key="tag"
          size="small"
          round
        >
          {{ tag }}
        </el-tag>
      </div>

      <div class="template-card__footer">
        <span class="template-card__usage">使用 {{ template.usageCount }} 次</span>
        <div
          class="template-card__actions"
          @click.stop
        >
          <el-button
            v-if="!template.isDefault"
            link
            type="warning"
            @click="emit('setDefault')"
          >
            设为默认
          </el-button>
          <el-button
            link
            type="primary"
            @click="emit('view')"
          >
            详情
          </el-button>
          <el-button
            link
            type="danger"
            @click="emit('delete')"
          >
            删除
          </el-button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.template-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  overflow: hidden;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 8px 24px rgba(37, 99, 235, 0.08);
    transform: translateY(-2px);
  }

  &--active {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
  }

  &--featured .template-card__gradient {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%);
  }

  &--default .template-card__gradient {
    background: linear-gradient(135deg, #78350f 0%, #b45309 55%, #d97706 100%);
  }
}

.template-card__visual {
  position: relative;
}

.template-card__gradient {
  position: relative;
  min-height: 120px;
  padding: 20px 16px;
  background: linear-gradient(135deg, #334155 0%, #475569 100%);
  color: #f8fafc;

  &--svg {
    background: linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #6366f1 100%);
  }
}

.template-card__badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(251, 191, 36, 0.92);
  color: #78350f;
  font-weight: 600;

  &--default {
    background: rgba(254, 243, 199, 0.95);
    color: #92400e;
  }
}

.template-card__svg-tag {
  display: inline-block;
  margin-bottom: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.16);
}

.template-card__visual-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.template-card__body {
  padding: 14px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.template-card__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.template-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.template-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.template-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.template-card__usage {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.template-card__actions {
  display: flex;
  gap: 4px;
}
</style>
