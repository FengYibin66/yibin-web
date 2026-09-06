import type { ExperienceItem } from './types'

/**
 * 一个项目分类，对应的经历详情页链接（没有就是 `undefined`）。
 *
 * 规则与 `TimelineItem.tsx` 里的 `detailHref` 完全一致：**那条经历写了 `detail`
 * 才给链接**。不能只看 id 对不对得上——详情页路由是 `generateStaticParams` 遍历
 * 全部经历生成的，每个 id 都开得出页面，但没有 `detail` 的那些页面是空的。
 *
 * 抽成纯函数而不是在组件里写三目：这条规则现在有两个使用方（时间轴的「查看详情」、
 * 项目分类标题），各写一遍迟早在「哪些经历算有详情」上分叉。
 *
 * 起因是一个实机 bug：McAllister 分类的 summary 写着「详情见工作经历」，
 * `/classic/experience/mcallister/` 也确实做好了，但全站没有一处链过去——
 * 那句话成了死路标，用户点了卡片以为页面坏了。
 */
export function projectCategoryDetailHref(
  categoryId: string,
  experience: readonly ExperienceItem[],
): string | undefined {
  const match = experience.find((item) => item.id === categoryId)
  return match?.detail ? `/classic/experience/${match.id}/` : undefined
}
