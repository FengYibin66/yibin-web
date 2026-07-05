<script setup lang="ts">
const props = defineProps<{
  html: string
  title?: string
}>()
</script>

<template>
  <div class="html-preview">
    <iframe
      class="html-preview__frame"
      :title="props.title ?? '成稿预览'"
      sandbox=""
      :srcdoc="props.html"
    />
  </div>
</template>

<style scoped lang="scss">
.html-preview {
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  overflow: hidden;
  background: var(--el-bg-color);
}

.html-preview__frame {
  width: 100%;
  min-height: 420px;
  border: none;
  display: block;
}
</style>
