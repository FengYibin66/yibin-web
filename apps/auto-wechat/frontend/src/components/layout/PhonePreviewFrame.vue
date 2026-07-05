<script setup lang="ts">
import { computed } from 'vue'

import HtmlPreview from '@/components/HtmlPreview.vue'

const props = withDefaults(
  defineProps<{
    html: string
    title?: string
    /** @deprecated 使用 size="compact" */
    compact?: boolean
    size?: 'compact' | 'default' | 'large'
  }>(),
  { size: 'default' },
)

const resolvedSize = computed(() => (props.compact ? 'compact' : props.size))
</script>

<template>
  <div
    class="phone-frame"
    :class="`phone-frame--${resolvedSize}`"
  >
    <div class="phone-frame__chrome">
      <span class="phone-frame__speaker" />
      <span class="phone-frame__label">微信图文预览</span>
    </div>
    <div class="phone-frame__screen">
      <HtmlPreview
        :html="html"
        :title="title ?? '模板预览'"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.phone-frame {
  width: 100%;
  margin: 0 auto;
  border-radius: 28px;
  padding: 12px 10px 16px;
  background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
  box-shadow:
    0 20px 50px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.phone-frame--default {
  max-width: 400px;

  :deep(.html-preview__frame) {
    min-height: 480px;
    max-height: 72vh;
  }
}

.phone-frame--large {
  max-width: 520px;
  padding: 14px 12px 18px;
  border-radius: 32px;

  .phone-frame__speaker {
    width: 64px;
    height: 6px;
  }

  .phone-frame__label {
    font-size: 11px;
  }

  .phone-frame__screen {
    border-radius: 22px;
  }

  :deep(.html-preview__frame) {
    min-height: 720px;
    max-height: calc(100vh - 160px);
  }
}

.phone-frame--compact {
  max-width: 280px;
  padding: 8px 6px 10px;
  border-radius: 20px;

  .phone-frame__chrome {
    margin-bottom: 6px;
  }

  .phone-frame__screen {
    border-radius: 12px;
  }

  :deep(.html-preview__frame) {
    min-height: 200px;
    max-height: 240px;
  }
}

.phone-frame__chrome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
}

.phone-frame__speaker {
  width: 56px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.phone-frame__label {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
}

.phone-frame__screen {
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
}

:deep(.html-preview) {
  border: none;
  border-radius: 0;
}
</style>
