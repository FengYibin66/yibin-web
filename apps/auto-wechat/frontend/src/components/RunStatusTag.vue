<script setup lang="ts">
import type { RunStatus } from '@/constants/pipeline'
import { getRunStatusLabel, getRunStatusTagType } from '@/utils/format'

const props = defineProps<{
  status: RunStatus
}>()
</script>

<template>
  <el-tag
    :type="getRunStatusTagType(props.status)"
    size="small"
  >
    {{ getRunStatusLabel(props.status) }}
  </el-tag>
</template>
