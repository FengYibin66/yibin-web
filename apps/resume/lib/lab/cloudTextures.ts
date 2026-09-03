/**
 * 云纹理清单 —— 唯一来源。
 *
 * 这 8 个路径原先在**三个文件里各有一份拷贝**：`lib/lab/roomAssets.ts`、
 * `components/rooms/about/SkyChunk.tsx`、`components/rooms/gallery/GalleryClouds.tsx`。
 * 三份的内容恰好一致，但没有任何东西保证它们一致——而这正是审计 A2 的根因
 * 类型：Contact 房间的云是四个无贴图白矩形，因为 `ROOM_ASSETS.contact` 漏收
 * 了这份清单，漏收不会报错、只会让天空里飘几个灰块。
 *
 * 文件名是内容哈希（原始素材如此），不携带语义，所以看不出漏了哪张——更需要
 * 单一来源。`__tests__/cloudField.test.ts` 断言没有其它文件再自带副本。
 */
export const CLOUD_TEXTURES = [
  '/textures/clouds/1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp',
  '/textures/clouds/254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp',
  '/textures/clouds/2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp',
  '/textures/clouds/5606fcc0-3252-447d-a58a-7bcbac73229a.webp',
  '/textures/clouds/7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp',
  '/textures/clouds/9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp',
  '/textures/clouds/c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp',
  '/textures/clouds/f6e358bc-d27c-41dd-95f4-6787a835c41e.webp',
] as const

/**
 * 原始宽高比。
 *
 * 需要显式记下来是因为这些图不是 2 的幂，GPU 侧的 POT 转换会拉伸它们——
 * 按实际像素算出来的宽高比会失真，所以用素材的原始值。
 */
export const CLOUD_ASPECTS: Record<string, number> = {
  '1131c3eb-dfae-423f-924b-ff39d8ccd6dc.webp': 1.894,
  '254b8ec8-d6f7-4275-956f-7bab65b2ce2d.webp': 2.459,
  '2cc88dd1-483c-466d-b07e-f8308c61ccbe.webp': 3.577,
  '5606fcc0-3252-447d-a58a-7bcbac73229a.webp': 1.794,
  '7882dc72-3d01-41fb-ac0e-d07b0184ebc1.webp': 1.997,
  '9b2ca72f-7bd0-473b-ba6e-dd9e0eb79d35.webp': 1.905,
  'c83293c6-d90c-4a32-8d9d-5ac9af7e2296.webp': 3,
  'f6e358bc-d27c-41dd-95f4-6787a835c41e.webp': 1.875,
}

/** 默认宽高比：清单里查不到时用它，避免 NaN 把 planeGeometry 撑坏 */
export const CLOUD_FALLBACK_ASPECT = 1.8

export function cloudAspect(texturePath: string): number {
  const file = texturePath.split('/').pop() ?? ''
  return CLOUD_ASPECTS[file] ?? CLOUD_FALLBACK_ASPECT
}
