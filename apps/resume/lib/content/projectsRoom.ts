import { content, type Locale } from '@/lib/content'
import type { ProjectItem } from '@/lib/content/types'
import { MONITOR_RING } from '@/lib/lab/domain/rooms/projects/scene'
import type { StickySpec } from '@/lib/lab/domain/sketch/types'

/**
 * Projects 房间要展示的项目。
 *
 * ## 平台隐喻已去掉
 *
 * 原先每个项目被硬分为 `blog / youtube / tiktok` 三种「平台」，决定它用
 * 显示器、电视还是手机做载体——那是从 itomdev 原版（一个自媒体作品集）
 * 搬来的模型，而本站的项目不是自媒体内容。分类是按数组下标轮转的
 * （`PLATFORM_CYCLE[i % 4]`），也就是说它连"这个项目属于哪类"都没表达，
 * 纯粹是视觉变化。
 *
 * 去掉它偿还三笔（ADR 20260903140619 的连带决定）：
 *   - `ROOM_ASSETS.projects` 从 28 张纹理降到 12 张
 *   - 每个 `MonitorBlock` 无条件声明 26 个 `useTexture` loader（AGENTS.md
 *     里登记的最后一条未修项）
 *   - "为什么这个项目是抖音"这个无法回答的问题
 */

export interface ProjectRoomItem {
  id: string
  title: string
  /** 副标题：技术栈或描述摘要 */
  sub: string
  url?: string
  /** 完整技术栈，停靠时写在便签上 */
  tech: readonly string[]
  description: string
}

/**
 * 挑一批项目进房间。
 *
 * 顺序：个人项目 → Epic → 学而思。上限来自空间声明（`MONITOR_RING.max`）
 * 而不是这里另定一个数——显示器环能摆几块是几何问题，由几何那侧决定。
 */
export function getProjectRoomItems(
  locale: Locale,
  // 显式 number：`MONITOR_RING.max` 是 `as const`，不标注会把参数类型
  // 窄化成字面量 8，调用侧传别的数字就编译不过
  limit: number = MONITOR_RING.max,
): readonly ProjectRoomItem[] {
  const categories = content[locale].projects.categories
  const picked: ProjectItem[] = []

  const take = (items: readonly ProjectItem[] | undefined) => {
    for (const item of items ?? []) {
      if (picked.length >= limit) return
      picked.push(item)
    }
  }

  take(categories.find(c => c.id === 'personal')?.items)
  take(categories.find(c => c.id === 'epic')?.items)

  if (picked.length < limit) {
    for (const group of categories.find(c => c.id === 'xueersi')?.groups ?? []) {
      take(group.items)
      if (picked.length >= limit) break
    }
  }

  return picked.map((item, i) => ({
    id: `${item.name}-${i}`,
    title: item.name,
    sub: item.tech.slice(0, 3).join(' · ') || item.description.slice(0, 42),
    url: item.url,
    tech: item.tech,
    description: item.description,
  }))
}

/** 便签一行最多几个字符。超了就换行——折行在这里决定，渲染侧不猜 */
const STICKY_LINE_CHARS = 18
/** 便签最多几行。放不下的技术栈截断，写不下就是写不下 */
const STICKY_MAX_LINES = 4

/**
 * 把技术栈折成便签的行。
 *
 * 导出它是为了能单测折行：便签的手写层不做自动折行（`planSticky` 拿到的
 * `lines` 就是最终行），所以折行错了的表现是文字画到便签外面去——
 * 不报错，只是看起来出界。
 */
export function stickyLines(
  tech: readonly string[],
  maxChars = STICKY_LINE_CHARS,
  maxLines = STICKY_MAX_LINES,
): string[] {
  const lines: string[] = []
  let current = ''
  for (const item of tech) {
    const candidate = current ? `${current} · ${item}` : item
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    if (lines.length >= maxLines) return lines.slice(0, maxLines)
    // 单项本身就超长：硬截，好过画出界
    current = item.length > maxChars ? `${item.slice(0, maxChars - 1)}…` : item
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines.slice(0, maxLines)
}

/**
 * 项目 → 便签声明。
 *
 * `id` 用项目 id：`specKey` 是 `kind:id`，所以每个项目有自己的抖动，而
 * 同一个项目跨房间进出复用同一张纹理（缓存命中）。
 */
export function stickyForProject(
  item: ProjectRoomItem,
  size: { width: number; height: number },
): StickySpec {
  return {
    kind: 'sticky',
    id: `project-${item.id}`,
    size,
    title: item.title,
    lines: stickyLines(item.tech),
    pinned: true,
  }
}
