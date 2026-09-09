'use client'

import { useEffect, useRef, useState } from 'react'
import { EntryStage } from '@/components/entry/EntryStage'
import { useLabLabels } from '@/hooks/useLabLabels'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { ClassicPanel } from '@/components/entry/ClassicPanel'
import { ExplorerBar } from '@/components/entry/ExplorerBar'
import { EntryLocaleToggle } from '@/components/entry/EntryLocaleToggle'
import { EntryAudioToggle } from '@/components/entry/EntryAudioToggle'
import { EdgeItem, EdgeLayerRoot } from '@/components/layout/EdgeLayer'
import { AudioProvider } from '@/context/AudioContext'
import type { EntryPreviewSceneProps } from '@/components/entry/EntryPreviewScene'

// Lightweight DOM-only fallback shown while the three.js chunk downloads.
// Must not import drei/three — that would defeat the code split.
function PreviewChunkFallback() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: '18%',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 11,
          letterSpacing: '0.3em',
          color: 'rgba(42,31,14,0.4)',
          textTransform: 'uppercase',
          animation: 'entryPulse 1.4s ease-in-out infinite',
        }}
      >
        Sketching the door…
      </span>
      <style>{`@keyframes entryPulse { 0%,100% { opacity: 0.35 } 50% { opacity: 0.9 } }`}</style>
    </div>
  )
}

const EntryPreviewScene = dynamic<EntryPreviewSceneProps>(
  () => import('@/components/entry/EntryPreviewScene').then(m => ({ default: m.EntryPreviewScene })),
  { ssr: false, loading: () => <PreviewChunkFallback /> }
)

export default function EntryPage() {
  /*
    `HTMLElement` 而不是 `HTMLDivElement`：Classic 面板已经是 `<a>`（审计 E3
    要求可聚焦、可爬），两个面板的元素类型不同。这里只用到 style 与
    addEventListener，`HTMLElement` 就够——强转成 Anchor 是把类型问题
    藏起来而不是解决它。
  */
  const leftRef  = useRef<HTMLDivElement>(null)
  // Classic 面板是 `<a>`（审计 E3 要求可聚焦、可爬），类型跟着元素走
  const rightRef = useRef<HTMLAnchorElement>(null)
  const router   = useRouter()
  const labels   = useLabLabels()

  // Stacked layout on small screens — the side-by-side split is unusable there.
  const [isStacked, setIsStacked] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsStacked(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const left  = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    gsap.fromTo(left,  { xPercent: -100, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out' })
    gsap.fromTo(right, { xPercent:  100, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out' })

    // Dispatch resize on every GSAP tick so R3F re-computes the WebGL viewport
    // in sync with the flexBasis CSS animation (ResizeObserver alone is too slow).
    const dispatchResize = () => window.dispatchEvent(new Event('resize'))

    const expandFull = () => {
      gsap.to(left,  { flexBasis: '100%', duration: 0.5, ease: 'power2.out', onUpdate: dispatchResize })
      gsap.to(right, { flexBasis: '0%',   duration: 0.5, ease: 'power2.out' })
    }
    window.addEventListener('entry-expand', expandFull)

    // Hover expand only makes sense on devices that can actually hover.
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!canHover) {
      return () => window.removeEventListener('entry-expand', expandFull)
    }

    const expandLeft = () => {
      gsap.to(left,  { flexBasis: '72%', duration: 0.6, ease: 'power2.out', onUpdate: dispatchResize })
      gsap.to(right, { flexBasis: '28%', duration: 0.6, ease: 'power2.out' })
    }
    const expandRight = () => {
      gsap.to(right, { flexBasis: '72%', duration: 0.6, ease: 'power2.out' })
      gsap.to(left,  { flexBasis: '28%', duration: 0.6, ease: 'power2.out', onUpdate: dispatchResize })
    }
    const reset = () => {
      gsap.to([left, right], { flexBasis: '50%', duration: 0.5, ease: 'power2.out', onUpdate: dispatchResize })
    }

    left.addEventListener('mouseenter', expandLeft)
    right.addEventListener('mouseenter', expandRight)
    left.addEventListener('mouseleave', reset)
    right.addEventListener('mouseleave', reset)
    return () => {
      left.removeEventListener('mouseenter', expandLeft)
      right.removeEventListener('mouseenter', expandRight)
      left.removeEventListener('mouseleave', reset)
      right.removeEventListener('mouseleave', reset)
      window.removeEventListener('entry-expand', expandFull)
    }
  }, [])

  return (
    <AudioProvider>
    <div style={{
      display: 'flex',
      flexDirection: isStacked ? 'column' : 'row',
      width: '100vw',
      height: '100dvh',
      overflow: 'hidden',
      touchAction: 'manipulation',
    }}>
      {/* TOP/LEFT — The Lab (hand-drawn corridor preview) */}
      <div
        ref={leftRef}
        style={{
          flexBasis: '50%',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          background: '#f5f0e8',
        }}
      >
        {/*
          手机端不挂 Canvas：`EntryStage` 判定 coarse pointer + 窄屏时渲染
          静态首帧（54 KB）而不是 3D 场景，省下 1553 KB 的 three.js + R3F。
          桌面路径就是下面这段原样（见 EntryStage.tsx 顶部的取舍说明）。
        */}
        <EntryStage>
          <div style={{ position: 'absolute', inset: 0 }}>
            <EntryPreviewScene onEnter={() => router.push('/lab')} />
          </div>

          {/*
            文案块本身是一个真链接（审计 E3）。

            原先整个面板只有 Canvas 的点击：**没有任何键盘可达的出口**，
            Tab 走不到、回车进不去；爬虫也找不到 /lab 与 /classic 的链接。
            做成 `<a href>` 之后三件事一起解决——键盘可达、可爬、右键"在新标签
            打开"也能用。

            `pointerEvents` 只给这一块开（Canvas 的门仍然可点），
            `width: 'fit-content'` 让链接的命中区域不覆盖整个面板，
            否则会挡住门的点击。
          */}
          <a
            href="/lab"
            aria-label={labels.entry.labCta}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              pointerEvents: 'none',
              gap: '8px',
              textDecoration: 'none',
            }}
          >
            <p style={{
              fontFamily: '"CabinSketch", var(--font-mono, monospace)',
              fontSize: '10px',
              letterSpacing: '0.4em',
              color: 'rgba(42,31,14,0.5)',
              textTransform: 'uppercase',
              margin: 0,
              // 文字本身可点、可聚焦；容器 pointerEvents 是 none，
              // 所以只有文字这一小块拦截点击，门的命中区域不受影响
              pointerEvents: 'auto',
            }}>
              {labels.entry.labEyebrow}
            </p>
            <h1 style={{
              fontFamily: '"CabinSketch", var(--font-display, sans-serif)',
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              fontWeight: 700,
              color: '#2a1f0e',
              margin: 0,
              textAlign: 'center',
              pointerEvents: 'auto',
            }}>
              {labels.entry.labTitle}
            </h1>
            <p style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              color: 'rgba(42,31,14,0.45)',
              letterSpacing: '0.15em',
              textAlign: 'center',
              margin: 0,
            }}>
              {labels.entry.labTagline}
            </p>
            {isStacked && (
              <p style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '10px',
                color: 'rgba(42,31,14,0.35)',
                letterSpacing: '0.2em',
                margin: '4px 0 0',
                textTransform: 'uppercase',
              }}>
                {labels.entry.labCtaTouch}
              </p>
            )}
          </a>
        </EntryStage>

        <div style={{
          position: 'absolute',
          bottom: isStacked ? '16px' : '32px',
          right: isStacked ? '16px' : '32px',
          fontFamily: 'var(--font-mono)',
          fontSize: '20px',
          color: 'rgba(42,31,14,0.35)',
          zIndex: 10,
          pointerEvents: 'none',
        }}>→</div>
      </div>

      {/* Divider */}
      <div style={{
        width: isStacked ? '100%' : '1px',
        height: isStacked ? '1px' : 'auto',
        background: 'rgba(42,31,14,0.1)',
        flexShrink: 0,
        zIndex: 20,
      }} />

      {/* BOTTOM/RIGHT — Classic (light, elegant) */}
      {/*
        Classic 面板也是真链接（审计 E3）——原先是 `div onClick`，
        键盘走不到、爬虫看不见。
      */}
      <a
        ref={rightRef}
        href="/classic"
        aria-label={labels.entry.classicCta}
        style={{
          flexBasis: '50%',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'block',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <ClassicPanel />
      </a>

      {/*
        域名水印。**定位与出现条件都不在这里**——由
        `EdgeItem id="entry-watermark"` 放进 `bottom-left` 槽位、
        `presence: 'desktop'` 决定只在宽屏出现（ADR 20260909182319）。

        它原先自己写 `fixed; bottom:16; left:50%; translateX(-50%)`，与
        `ExplorerBar` **逐字同坐标**、z 差 70（30 vs 100），于是桌面上被那条
        白底提示 100% 盖住，从 ExplorerBar 上线那天起没人见过（实测 2026-09-09：
        bar [415,736 451×49] × 水印 [560,769 160×15]，`elementFromPoint`
        在水印中心命中的是 bar）。

        这条与「提示盖住『打开简历』主按钮」是同一个缺陷的**桌面镜像**：
        屏幕的角是共享资源而没有所有权，谁 fixed 到同一坐标都不知道对方在。
      */}
    </div>
    {/*
      屏角挂件全部经 EdgeLayerRoot 放进声明好的槽位（ADR 20260909182319）。
      这里不写任何坐标与 z——同槽位的挂件是同一个 flex 容器的兄弟，
      几何上不可能重叠，而这正是原先四处重叠的成因。
    */}
    <EdgeLayerRoot>
      {/* 语言在门户定，进 Lab / Classic 都沿用（见 EntryLocaleToggle 的说明） */}
      <EdgeItem id="entry-locale"><EntryLocaleToggle /></EdgeItem>
      {/* 静音开关：原先是底部提示文本里的 [ON]/[OFF]，见 EntryAudioToggle 的说明 */}
      <EdgeItem id="entry-audio"><EntryAudioToggle /></EdgeItem>
      <EdgeItem id="entry-explorer-hint"><ExplorerBar /></EdgeItem>
      <EdgeItem id="entry-watermark">
        <span style={{
          fontSize: '10px',
          color: 'rgba(42,31,14,0.25)',
          letterSpacing: '0.2em',
          fontFamily: 'var(--font-mono, monospace)',
        }}>
          resume.yibinfeng.com
        </span>
      </EdgeItem>
    </EdgeLayerRoot>
    </AudioProvider>
  )
}
