/**
 * Classic 页滚动显形的**声明**——纯数据，不依赖 gsap，所以 E2E（Node 侧）与单测都能
 * 直接 import。运行时在 `./scrollReveal.ts`。
 *
 * 每条 `targets` / `trigger` 必须在渲染出的 Classic 各区里匹配到元素
 * （`__tests__/scrollReveal.test.tsx` 守着）。前身有三条选择器匹配不到任何东西
 * （`#about .edu-card`、`#contact .contact-item`），教育卡翻转与联系区渐入从来没跑过，
 * 线上每次进 Classic 打 3 条 gsap 空目标警告——「声明了」与「接上了」分叉了两年没人发现。
 */

export interface RevealSpec {
  /** 唯一名，排查时用 */
  readonly name: string
  /** 被动画的元素 */
  readonly targets: string
  /** 触发滚动判定的容器（通常是所在 section） */
  readonly trigger: string
  /** ScrollTrigger 的 start */
  readonly start: string
  /** 起点。键只能取 `REVEAL_END` 里有的（外加 `transformPerspective`） */
  readonly from: Readonly<Record<string, number>>
  readonly duration: number
  readonly stagger?: number
  readonly ease: string
}

/** 终点：一切回到「无变换、全显」。`fromTo` 的 to 按 from 的键从这里取 */
export const REVEAL_END: Readonly<Record<string, number>> = { opacity: 1, x: 0, y: 0, scale: 1, rotateX: 0 }

const SECTION_IDS = ['about', 'education', 'skills', 'experience', 'projects', 'publications', 'credentials', 'contact'] as const

export const REVEALS: readonly RevealSpec[] = [
  ...SECTION_IDS.map<RevealSpec>(id => ({
    name: `title:${id}`,
    targets: `#${id} .section-title-text`,
    trigger: `#${id}`,
    start: 'top 88%',
    from: { opacity: 0, y: 16 },
    duration: 0.7,
    ease: 'power2.out',
  })),
  { name: 'about:bio', targets: '#about .animate-in', trigger: '#about', start: 'top 75%', from: { opacity: 0, y: 40 }, duration: 0.7, stagger: 0.1, ease: 'power2.out' },
  { name: 'education:cards', targets: '#education .edu-card', trigger: '#education', start: 'top 70%', from: { opacity: 0, rotateX: -50, transformPerspective: 800 }, duration: 0.7, stagger: 0.12, ease: 'back.out(1.4)' },
  { name: 'skills:badges', targets: '#skills .skill-badge', trigger: '#skills', start: 'top 75%', from: { opacity: 0, x: -30 }, duration: 0.5, stagger: 0.04, ease: 'power2.out' },
  { name: 'experience:items', targets: '#experience .timeline-item', trigger: '#experience', start: 'top 70%', from: { opacity: 0, y: 50 }, duration: 0.6, stagger: 0.15, ease: 'power2.out' },
  { name: 'projects:cards', targets: '#projects .project-card', trigger: '#projects', start: 'top 75%', from: { opacity: 0, scale: 0.92 }, duration: 0.6, stagger: 0.08, ease: 'back.out(1.2)' },
  { name: 'publications:cards', targets: '#publications .publication-card', trigger: '#publications', start: 'top 75%', from: { opacity: 0, y: 50 }, duration: 0.7, stagger: 0.1, ease: 'power2.out' },
  { name: 'contact:columns', targets: '#contact .contact-item', trigger: '#contact', start: 'top 80%', from: { opacity: 0, y: 30 }, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
]
