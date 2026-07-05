import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  createLayoutTemplate,
  deleteLayoutTemplate,
  getLayoutTemplate,
  listLayoutTemplates,
  setDefaultLayoutTemplate,
} from '@/api/layoutTemplates'
import { ROUTE_NAMES } from '@/constants/routes'
import { articleTypeLabel } from '@/utils/layoutOutput'

import type {
  CreateLayoutTemplatePayload,
  LayoutTemplateDetail,
  LayoutTemplateSummary,
} from '@/types/layoutTemplate'

export type LayoutTemplateSvgFilter = 'all' | 'yes' | 'no'
export type LayoutTemplateFeaturedFilter = 'all' | 'yes'

export function useLayoutTemplateLibrary() {
  const router = useRouter()

  const loading = ref(false)
  const templates = ref<LayoutTemplateSummary[]>([])
  const selectedId = ref<string | null>(null)
  const previewDetail = ref<LayoutTemplateDetail | null>(null)
  const previewLoading = ref(false)

  const keyword = ref('')
  const filterArticleType = ref('')
  const filterSvg = ref<LayoutTemplateSvgFilter>('all')
  const filterFeatured = ref<LayoutTemplateFeaturedFilter>('all')
  const filterTag = ref('')

  const importVisible = ref(false)
  const importSaving = ref(false)

  const filteredTemplates = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return templates.value.filter((item) => {
      if (filterArticleType.value && item.articleType !== filterArticleType.value) {
        return false
      }
      if (filterSvg.value === 'yes' && !item.hasSvg) {
        return false
      }
      if (filterSvg.value === 'no' && item.hasSvg) {
        return false
      }
      if (filterFeatured.value === 'yes' && !item.isFeatured) {
        return false
      }
      if (filterTag.value && !(item.tags ?? []).includes(filterTag.value)) {
        return false
      }
      if (!kw) {
        return true
      }
      const haystack = [
        item.name,
        item.description ?? '',
        ...(item.tags ?? []),
        articleTypeLabel(item.articleType),
      ].join(' ').toLowerCase()
      return haystack.includes(kw)
    })
  })

  const allTags = computed(() => {
    const set = new Set<string>()
    for (const item of templates.value) {
      for (const tag of item.tags ?? []) {
        set.add(tag)
      }
    }
    return [...set].sort()
  })

  const selectedSummary = computed(() => {
    if (!selectedId.value) {
      return null
    }
    return templates.value.find((item) => item.id === selectedId.value) ?? null
  })

  async function fetchTemplates(): Promise<void> {
    loading.value = true
    try {
      templates.value = await listLayoutTemplates()
      if (templates.value.length && !selectedId.value) {
        selectedId.value = templates.value[0].id
      }
      if (selectedId.value && !templates.value.some((item) => item.id === selectedId.value)) {
        selectedId.value = templates.value[0]?.id ?? null
      }
    } finally {
      loading.value = false
    }
  }

  async function loadPreview(id: string): Promise<void> {
    previewLoading.value = true
    try {
      previewDetail.value = await getLayoutTemplate(id)
    } catch {
      previewDetail.value = null
    } finally {
      previewLoading.value = false
    }
  }

  watch(selectedId, (id) => {
    if (id) {
      void loadPreview(id)
    } else {
      previewDetail.value = null
    }
  })

  function handleSelect(id: string): void {
    selectedId.value = id
  }

  function handleViewDetail(id: string): void {
    void router.push({
      name: ROUTE_NAMES.LAYOUT_TEMPLATE_DETAIL,
      params: { id },
    })
  }

  async function handleDelete(item: LayoutTemplateSummary): Promise<void> {
    try {
      await ElMessageBox.confirm(
        `确定删除模板「${item.name}」？删除后不可恢复，已完成的 Run 不受影响。`,
        '删除模板',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
      )
    } catch {
      return
    }

    try {
      await deleteLayoutTemplate(item.id)
      ElMessage.success('已删除')
      if (selectedId.value === item.id) {
        selectedId.value = null
        previewDetail.value = null
      }
      await fetchTemplates()
    } catch {
      await fetchTemplates()
    }
  }

  async function handleImport(payload: CreateLayoutTemplatePayload): Promise<void> {
    importSaving.value = true
    try {
      const created = await createLayoutTemplate(payload)
      importVisible.value = false
      ElMessage.success('模板已导入')
      await fetchTemplates()
      selectedId.value = created.id
    } finally {
      importSaving.value = false
    }
  }

  async function handleSetDefault(item: LayoutTemplateSummary): Promise<void> {
    try {
      await ElMessageBox.confirm(
        `将「${item.name}」设为 ${articleTypeLabel(item.articleType)} 的全局默认排版模板？新建 Run 时会自动复制此模板。`,
        '设为默认',
        { type: 'info', confirmButtonText: '设为默认', cancelButtonText: '取消' },
      )
    } catch {
      return
    }

    try {
      await setDefaultLayoutTemplate(item.id)
      ElMessage.success('已设为全局默认')
      await fetchTemplates()
    } catch {
      await fetchTemplates()
    }
  }

  return {
    loading,
    templates,
    selectedId,
    previewDetail,
    previewLoading,
    keyword,
    filterArticleType,
    filterSvg,
    filterFeatured,
    filterTag,
    importVisible,
    importSaving,
    filteredTemplates,
    allTags,
    selectedSummary,
    fetchTemplates,
    handleSelect,
    handleViewDetail,
    handleDelete,
    handleImport,
    handleSetDefault,
  }
}
