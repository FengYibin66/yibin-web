'use client'

import { useEffect, useState } from 'react'

import { COARSE_QUERY, HOVER_QUERY, NARROW_QUERY } from '@/lib/layout/breakpoints'

/**
 * 视口形态判据的单一读点（ADR 20260909182319）。
 *
 * ## 为什么要收编
 *
 * `pointer: coarse` 此前在**六个**文件各查一次、各存一份 state（`EntryStage` /
 * `ExplorerBar` / `EntryPreviewScene` / `ArtworkFrame` / `LabScene` / `LabTutorial`），
 * `matchMedia` 散在 10 个文件。而 `hooks/useMotionScale.ts` 的文件头注释逐字写着
 * 这个病：「有人订阅 store、有人调 matchMedia、有人干脆自己存一份，于是同一时刻…」
 * ——reduced-motion 已经因此收归 `lib/lab/app/motion.ts` 单一入口并由
 * `motionConsumers.test.ts` 守着（零例外）。触屏与窄屏判据没有做同样的事。
 *
 * ## 三个字段不许压成一个布尔
 *
 * 它们是**三个独立维度**，历史上已有两次回归证明这一点（记在
 * `apps/resume/AGENTS.md`）：
 *
 *   只看宽度  → 拖窄的桌面窗口掉进「手机静态图」路径（有鼠标却拿不到 3D）
 *   只看指针  → iPad 横屏很宽却掉进手机路径
 *   `!isTouch` 代替 `canHover` → Surface / 接了鼠标的 iPad 两个查询都为真，判错
 *
 * 所以 `EntryStage` 要的是 `isTouch && isNarrow` 两个条件同时成立，
 * `GlowButton` 要的是 `canHover`，各取所需，不要在这里替调用方"简化"。
 *
 * ## `null` 中间态是必须的
 *
 * SSR / 预渲染时读不到 `matchMedia`。直接默认某一边会让 hydration 前后不一致
 * （预渲染出桌面版、手机上第一帧闪一下）。判定完成前调用方应当**两条路径都不渲染**
 * 或渲染中性内容。这个写法与它为什么必须存在，照抄 `EntryStage` 的既有注释。
 */
export interface Viewport {
  /** 窄屏（< 768）。与「触屏」无关——iPad 横屏不窄但是触屏 */
  isNarrow: boolean
  /** 粗指针（手指）。与「窄」无关 */
  isTouch: boolean
  /** 支持悬停。**不是** `!isTouch`——同时有触摸与鼠标的设备两者都为真 */
  canHover: boolean
}

/** `null` = 还没判定（SSR / 首帧）。调用方必须处理这个态 */
export function useViewport(): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null)

  useEffect(() => {
    const narrow = window.matchMedia(NARROW_QUERY)
    const coarse = window.matchMedia(COARSE_QUERY)
    const hover = window.matchMedia(HOVER_QUERY)

    const read = () => setViewport({
      isNarrow: narrow.matches,
      isTouch: coarse.matches,
      canHover: hover.matches,
    })

    read()
    // 用 MediaQueryList 的 change 而不是 window.resize：resize 在滚动时也会
    // 在移动 Safari 上触发（地址栏收起改变视口高度），而这三个查询都只关心
    // 宽度与指针能力，没必要跟着高度变化重算。
    narrow.addEventListener('change', read)
    coarse.addEventListener('change', read)
    hover.addEventListener('change', read)
    return () => {
      narrow.removeEventListener('change', read)
      coarse.removeEventListener('change', read)
      hover.removeEventListener('change', read)
    }
  }, [])

  return viewport
}
