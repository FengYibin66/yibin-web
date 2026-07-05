import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { deleteImageAsset, listImageAssets } from '@/api/imageAssets'

import type { ImageAsset } from '@/types/imageAsset'

export function useImageLibrary() {
  const loading = ref(false)
  const assets = ref<ImageAsset[]>([])
  const keyword = ref('')
  const filterSource = ref('')

  const filteredAssets = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return assets.value.filter((asset) => {
      if (filterSource.value && asset.source !== filterSource.value) {
        return false
      }
      if (!kw) {
        return true
      }
      return asset.name.toLowerCase().includes(kw)
        || (asset.originUrl ?? '').toLowerCase().includes(kw)
    })
  })

  async function fetchAssets(): Promise<void> {
    loading.value = true
    try {
      assets.value = await listImageAssets({
        source: filterSource.value || undefined,
        q: keyword.value.trim() || undefined,
      })
    } finally {
      loading.value = false
    }
  }

  async function handleDelete(asset: ImageAsset): Promise<void> {
    await ElMessageBox.confirm(`确定删除「${asset.name}」？`, '删除图片', { type: 'warning' })
    await deleteImageAsset(asset.id)
    ElMessage.success('已删除')
    await fetchAssets()
  }

  return {
    loading,
    assets,
    keyword,
    filterSource,
    filteredAssets,
    fetchAssets,
    handleDelete,
  }
}
