<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'

import {
  createReadSourcePreset,
  deleteReadSourcePreset,
  listReadSourcePresets,
} from '@/api/readSourcePresets'
import type { ReadSourcePreset } from '@/types/readSourcePreset'

const model = defineModel<string>({ default: '' })

const loading = ref(false)
const deleting = ref(false)
const adding = ref(false)
const addDialogVisible = ref(false)
const addFormRef = ref<FormInstance>()
const addForm = reactive({
  label: '',
  url: '',
})
const addFormRules: FormRules = {
  url: [
    { required: true, message: '请输入链接', trigger: 'blur' },
    { pattern: /^https?:\/\/.+/i, message: '请输入以 http:// 或 https:// 开头的链接', trigger: 'blur' },
  ],
}
const presets = ref<ReadSourcePreset[]>([])

const selectedPreset = computed(() => presets.value.find((p) => p.id === model.value))
const canDelete = computed(() => presets.value.length > 1 && Boolean(model.value))

function syncSelectionAfterListChange(): void {
  if (presets.value.length === 0) {
    model.value = ''
    return
  }
  if (!presets.value.some((p) => p.id === model.value)) {
    model.value = presets.value[0].id
  }
}

async function loadPresets(): Promise<void> {
  loading.value = true
  try {
    presets.value = await listReadSourcePresets()
    syncSelectionAfterListChange()
    if (!model.value && presets.value.length > 0) {
      model.value = presets.value[0].id
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载阅读原文列表失败')
  } finally {
    loading.value = false
  }
}

function openAddDialog(): void {
  addForm.label = ''
  addForm.url = ''
  addDialogVisible.value = true
}

async function submitAdd(): Promise<void> {
  const valid = await addFormRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  const url = addForm.url.trim()
  const label = addForm.label.trim() || url

  adding.value = true
  try {
    const created = await createReadSourcePreset({ label, url })
    presets.value = [...presets.value, created]
    model.value = created.id
    addDialogVisible.value = false
    ElMessage.success('已添加到列表')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '添加失败')
  } finally {
    adding.value = false
  }
}

async function handleDelete(): Promise<void> {
  const preset = selectedPreset.value
  if (!preset || !canDelete.value) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除「${preset.label}」？引用该链接的 Run 将回退为列表第一项。`,
      '删除阅读原文',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  deleting.value = true
  try {
    await deleteReadSourcePreset(preset.id)
    presets.value = presets.value.filter((p) => p.id !== preset.id)
    syncSelectionAfterListChange()
    ElMessage.success('已删除')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
  } finally {
    deleting.value = false
  }
}

watch(
  presets,
  () => {
    syncSelectionAfterListChange()
  },
  { deep: true },
)

onMounted(() => {
  void loadPresets()
})
</script>

<template>
  <div class="read-source-preset-select">
    <label class="read-source-preset-select__label">阅读原文</label>
    <div class="read-source-preset-select__row">
      <el-select
        v-model="model"
        v-loading="loading"
        filterable
        placeholder="选择阅读原文链接"
        class="read-source-preset-select__select"
      >
        <el-option
          v-for="item in presets"
          :key="item.id"
          :label="item.label"
          :value="item.id"
        >
          <span>{{ item.label }}</span>
          <span class="read-source-preset-select__option-url">{{ item.url }}</span>
        </el-option>
      </el-select>
      <el-button @click="openAddDialog">
        添加
      </el-button>
      <el-button
        type="danger"
        plain
        :disabled="!canDelete"
        :loading="deleting"
        @click="handleDelete"
      >
        删除
      </el-button>
    </div>
    <p
      v-if="selectedPreset"
      class="read-source-preset-select__hint"
    >
      发布时将使用：{{ selectedPreset.url }}
    </p>
    <p
      v-if="presets.length <= 1"
      class="read-source-preset-select__hint"
    >
      至少保留一条链接，无法删除最后一项。
    </p>

    <el-dialog
      v-model="addDialogVisible"
      title="添加阅读原文"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="addFormRef"
        :model="addForm"
        :rules="addFormRules"
        label-width="80px"
        @submit.prevent="submitAdd"
      >
        <el-form-item
          label="显示名称"
          prop="label"
        >
          <el-input
            v-model="addForm.label"
            placeholder="例如：个人主页（可留空，默认用链接）"
            maxlength="255"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item
          label="链接"
          prop="url"
        >
          <el-input
            v-model="addForm.url"
            placeholder="https://example.com"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="adding"
          @click="submitAdd"
        >
          添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.read-source-preset-select {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.read-source-preset-select__label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.read-source-preset-select__row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.read-source-preset-select__select {
  flex: 1;
  min-width: 200px;
}

.read-source-preset-select__option-url {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.read-source-preset-select__hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
</style>
