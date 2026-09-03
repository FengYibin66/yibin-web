'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useLabLabels } from '@/hooks/useLabLabels'

import styles from './EntryStage.module.css'

/**
 * 入口页那扇门的两条路径：手机走静态图，桌面走 Canvas。
 *
 * ## 为什么手机不挂 Canvas
 *
 * 入口页要先下 1553 KB 的脚本（three.js + R3F）再编译 shader 才能画出那扇门。
 * 手机访客为了一扇**静止的门**下载整个 3D 运行时，而这段时间面板是空的、
 * 文案却在说「点这扇门」。
 *
 * 静态首帧（`public/entry/door-firstframe.webp`，54 KB）随 HTML 直出，
 * 点了播 CSS 开门动画再跳 `/lab`。Lab 本身仍然是完整的 3D——**没有砍掉
 * 任何东西**，只是把"预览那扇门"这件事从 3D 降级为一张图。
 *
 * ## 为什么桌面**不用**静态图打底
 *
 * 审计的方案是三层渐进：静态图 → Canvas 淡入接管。桌面这一层我没做，
 * 理由是实测：桌面 canvas 在 592ms 就出现了，而多加一张图意味着**多一次
 * 下载**换 0.5 秒的占位。收益不抵成本。
 *
 * 判据用 `pointer: coarse` **且**窄屏，两个都要：
 *   - 只看宽度：桌面窗口拖窄会掉进静态路径，而它明明有能力跑 3D
 *   - 只看 pointer：iPad 横屏是 coarse 但屏幕足够大、性能也够
 */

/** 手机判据的宽度上限。与入口页的 `isStacked` 断点一致 */
const MOBILE_MAX_WIDTH = 768

/** CSS 开门动画的时长，要与 `EntryStage.module.css` 里的一致 */
const OPEN_ANIMATION_MS = 900

export interface EntryStageProps {
  /** 桌面路径要渲染的东西（3D 场景） */
  children: React.ReactNode
}

export function EntryStage({ children }: EntryStageProps) {
  const router = useRouter()
  const labels = useLabLabels()
  /**
   * `null` = 还没判定。
   *
   * 必须有这个中间态：SSR/预渲染时读不到 `matchMedia`，直接默认某一边会让
   * hydration 前后不一致（预渲染出桌面版、手机上第一帧闪一下 Canvas 容器）。
   * 判定完成前两条路径都不渲染，那一瞬间显示的是静态图——也就是最坏情况
   * 也不比原来差。
   */
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  const [opening, setOpening] = useState(false)
  const navigated = useRef(false)

  useEffect(() => {
    const check = () =>
      setIsMobile(
        window.matchMedia('(pointer: coarse)').matches &&
        window.innerWidth <= MOBILE_MAX_WIDTH,
      )
    check()
    // 转屏会同时改宽度与可能的 pointer 判定
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  /**
   * 开门后跳转。
   *
   * `navigated` 这个 ref 是必要的：动画期间用户可以再点一次（或按回车），
   * 不去重就会 push 两次，返回时要按两下才回到入口页。
   */
  const open = useCallback(() => {
    if (navigated.current) return
    navigated.current = true
    setOpening(true)
    window.setTimeout(() => router.push('/lab'), OPEN_ANIMATION_MS)
  }, [router])

  if (isMobile === false) return <>{children}</>

  return (
    <div className={styles.stage}>
      {/*
        `<a>` 而不是 div + onClick：键盘可达、可爬、右键能在新标签打开
        （审计 E3 的同一条）。`onClick` 里 preventDefault 是为了先播动画，
        动画完了再由 `open()` 跳转；JS 没跑起来时它退化成一个普通链接，
        直接跳 `/lab`——**没有 JS 也能进去**。
      */}
      <a
        href="/lab"
        aria-label={labels.entry.labCtaTouch}
        className={styles.doorLink}
        onClick={event => {
          event.preventDefault()
          open()
        }}
      >
        <img
          src="/entry/door-firstframe.webp"
          alt=""
          className={`${styles.door}${opening ? ` ${styles.opening}` : ''}`}
          width={828}
          height={1000}
          // 首屏内容，不能懒加载
          loading="eager"
          decoding="sync"
          draggable={false}
        />
        <span className={styles.overlay}>
          <span className={styles.eyebrow}>{labels.entry.labEyebrow}</span>
          <span className={styles.title}>{labels.entry.labTitle}</span>
          <span className={styles.tagline}>{labels.entry.labTagline}</span>
          <span className={styles.cta}>{labels.entry.labCtaTouch}</span>
        </span>
      </a>
    </div>
  )
}

/** 供测试与脚本引用同一个常量 */
EntryStage.MOBILE_MAX_WIDTH = MOBILE_MAX_WIDTH
EntryStage.OPEN_ANIMATION_MS = OPEN_ANIMATION_MS
