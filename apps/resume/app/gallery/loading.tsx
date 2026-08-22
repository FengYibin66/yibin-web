import { GalleryLoading } from '@/components/gallery/GalleryLoading'

/**
 * 路由级加载态（验收报告 P1-3）。
 *
 * 与 `GalleryClient` 里 dynamic 的 loading fallback 是**两个不同时机**，两者都要有：
 *   - 本文件：从别的路由导航过来、Gallery 这个路由段自身还在加载时
 *     （Lab 的 Gallery 门就是 `router.push('/gallery')` 走这条路）
 *   - dynamic loading：路由已就位，但 GalleryTrack 的 chunk 还没到
 *
 * 只补其中一个仍会白屏，所以复用同一个组件覆盖两处。
 */
export default function Loading() {
  return <GalleryLoading />
}
