<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import RunStatusTag from '@/components/RunStatusTag.vue'
import { usePipelineRun } from '@/composables/usePipelineRun'
import { formatDateTime } from '@/utils/format'

import { ROUTE_NAMES } from '@/constants/routes'

const router = useRouter()
const { recentRuns, listLoading, triggerLoading, fetchRecentRuns, triggerRun, deleteRun } = usePipelineRun()

function handleViewRun(id: string): void {
  void router.push({ name: ROUTE_NAMES.RUN_DETAIL, params: { id } })
}

onMounted(() => {
  void fetchRecentRuns()
})
</script>

<template>
  <section class="trigger-view">
    <el-card shadow="never">
      <template #header>
        <span>一键触发 Pipeline</span>
      </template>
      <p class="trigger-desc">
        采集 AI 资讯 → Top 10 → 写作 → 排版 → 微信草稿箱。个人订阅号需在 mp.weixin.qq.com 草稿箱手动点「发表」。
      </p>
      <el-button
        type="primary"
        :loading="triggerLoading"
        :disabled="triggerLoading"
        @click="triggerRun"
      >
        开始 Run
      </el-button>
    </el-card>

    <el-card
      v-loading="listLoading"
      shadow="never"
      class="recent-card"
    >
      <template #header>
        <span>最近 Run</span>
      </template>

      <el-empty
        v-if="!listLoading && recentRuns.length === 0"
        description="暂无运行记录"
      />

      <el-table
        v-else
        :data="recentRuns"
        stripe
      >
        <el-table-column
          prop="id"
          label="Run ID"
          min-width="220"
        />
        <el-table-column
          label="状态"
          width="120"
        >
          <template #default="{ row }">
            <RunStatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column
          label="创建时间"
          min-width="180"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="160"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="handleViewRun(row.id)"
            >
              查看
            </el-button>
            <el-button
              link
              type="danger"
              @click="deleteRun(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </section>
</template>

<style scoped lang="scss">
.trigger-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trigger-desc {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
}

.recent-card {
  margin-top: 8px;
}
</style>
