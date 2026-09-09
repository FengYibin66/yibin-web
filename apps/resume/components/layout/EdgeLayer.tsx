'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  EDGE_SLOTS,
  OVERLAY_ROOT_Z,
  SLOT_GAP,
  SLOT_INSET,
  overlayById,
  zOfLayer,
  type EdgeSlot,
  type OverlayPresence,
} from '@/lib/layout/overlays'
import { useViewport } from '@/hooks/useViewport'

/**
 * 屏角挂件的**唯一** `position: fixed` 写者（ADR 20260909182319）。
 *
 * ## 为什么是 portal 而不是「每个挂件自己 fixed 到声明的坐标」
 *
 * 后者只解决了「坐标写在一处」，**没有解决重叠**——两个挂件声明同一个槽位时，
 * 它们仍是两个各自绝对定位的盒子，撞不撞取决于内容宽度，和现状没有区别。
 *
 * 这里的做法是：`EdgeLayerRoot` 渲染八个**flex 容器**（一个槽位一个），
 * `EdgeItem` 把自己 portal 进对应容器。于是同槽位的占位者是 flex 兄弟，
 * 「两组绝对定位撞 80px」变成「一行里第二个的可用宽度变窄」——几何上不可能重叠。
 *
 * portal 的挂载顺序不确定，所以槽位内次序用 CSS `order` 从注册表读，不靠 DOM 顺序。
 *
 * ## 层叠：夹在中间是刻意的
 *
 * 根容器一个 `OVERLAY_ROOT_Z`(50) 的层叠上下文，本表内的挂件全活在里面。于是
 * 页面内容（现状最高 z=40）永远在下、全屏覆盖层（200 / 9998 / 9999）永远在上——
 * 既不用逐个调页面内容的 z，也不必冒险给全屏层重新定序（ADR 划为第二期、不做）。
 *
 * ## pointer-events
 *
 * 根与槽位容器是 `none`（否则一条透明的满屏 div 会吃掉整页点击），
 * 每个 `EdgeItem` 的包装层**按注册表的 `interactive` 字段**决定 auto / none。
 *
 * 不能无条件 `auto`：我第一版这么写，把入口页那条提示（它自己写着 `none`）
 * 盖掉了，于是它从「视觉遮挡但点得穿」变成**真的挡住「打开简历」主按钮**
 * ——实测 `elementFromPoint` 在按钮中心命中提示浮层、真点也不跳转，
 * 比它原来的样子更糟。
 *
 * 也不能按 `layer === 'hint'` 推断：路线引导要加的 coach mark 就是一个
 * **可点的提示**。是不是装饰与它在哪一层无关，所以必须显式声明。
 */

/** 由调用方经 `visible` 决定可见性的 presence（本组件判不了，见 EdgeItemProps） */
const CALLER_DRIVEN = new Set<OverlayPresence>(['first-visit', 'in-room', 'not-in-room'])

type SlotElements = Partial<Record<EdgeSlot, HTMLDivElement | null>>

const SlotContext = createContext<SlotElements | null>(null)

/** 槽位容器的定位与排布。窄屏内边距更小——手机上 16px 白吃可视宽度 */
function slotStyle(slot: EdgeSlot, isNarrow: boolean): React.CSSProperties {
  const { row, col, direction } = EDGE_SLOTS[slot]
  const inset = isNarrow ? SLOT_INSET.narrow : SLOT_INSET.wide
  // 一律叠 safe-area：刘海屏的左右、手势条的底部。不叠的话手机横屏时挂件会被
  // 圆角或手势条压住，而那只在真机上看得见（模拟器与 headless 都不复现）。
  const v = `calc(${inset}px + env(safe-area-inset-${row === 'top' ? 'top' : 'bottom'}, 0px))`
  const hLeft  = `calc(${inset}px + env(safe-area-inset-left, 0px))`
  const hRight = `calc(${inset}px + env(safe-area-inset-right, 0px))`
  const h = col === 'right' ? hRight : hLeft

  const style: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection: direction,
    alignItems: 'center',
    gap: SLOT_GAP,
    pointerEvents: 'none',
  }

  if (row === 'top') style.top = v
  else if (row === 'bottom') style.bottom = v
  else { style.top = '50%'; style.transform = 'translateY(-50%)' }

  if (col === 'stretch') {
    // 贯通整行：两端都钉住，`space-between` 把占位者分列两端。
    // 这是「几何上不可能重叠」对**跨角**情形的唯一实现方式——分处 top-left 与
    // top-right 的两组挂件互相不知道对方多宽，320px 上实测撞 80px。
    // 两端各用自己那一侧的 safe-area。第一版两边都写了 `h`（它按 col 派生，
    // stretch 落在 left 分支），于是右端吃的是**左边**的缺口宽度——
    // 刘海屏横屏时左右缺口不一样，右端会偏。这是测试输出里
    // `right: calc(16px + env(safe-area-inset-left))` 露出来的。
    style.left = hLeft
    style.right = hRight
    style.justifyContent = 'space-between'
    // 顶栏两端高度不同（12px 的文字链接 vs 44px 的按钮排），居中对齐才不歪。
    // 同时允许内容收缩：宽度不够时挤，而不是把兄弟推出视口。
    style.minWidth = 0
  } else if (col === 'left') style.left = h
  else if (col === 'right') style.right = h
  else {
    // 到这里 col 只可能是 'center'，row 只可能是 top / bottom —— 声明表里没有
    // middle-center 槽位，
    // TypeScript 按「相关联的解构收窄」直接证明了这一点（我第一版在这里写了
    // `row === 'middle' ? …` 的三元，tsc 报 TS2367「比较没有交集」，
    // 也就是那是一段永远不会走到的死代码）。
    style.left = '50%'
    style.transform = 'translateX(-50%)'
  }

  return style
}

const ALL_SLOTS = Object.keys(EDGE_SLOTS) as EdgeSlot[]

/**
 * 挂在页面根上，渲染八个槽位容器。每个页面**最多一个**。
 *
 * 它自己不显示任何东西——没有 `EdgeItem` 时是一层完全透明、不吃点击的 div。
 */
export function EdgeLayerRoot({ children }: { children?: React.ReactNode }) {
  const viewport = useViewport()
  const refs = useRef<SlotElements>({})
  // portal 的目标必须在 EdgeItem 渲染时已存在。用 state 触发一次重渲染，
  // 让子树在容器就位之后再挂载。
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  const isNarrow = viewport?.isNarrow ?? false

  return (
    <>
      <div
        data-edge-layer-root=""
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: OVERLAY_ROOT_Z,
          pointerEvents: 'none',
        }}
      >
        {ALL_SLOTS.map(slot => (
          <div
            key={slot}
            data-edge-slot={slot}
            ref={el => { refs.current[slot] = el }}
            style={slotStyle(slot, isNarrow)}
          />
        ))}
      </div>
      <SlotContext.Provider value={ready ? refs.current : null}>
        {children}
      </SlotContext.Provider>
    </>
  )
}

export interface EdgeItemProps {
  /** 必须已在 `OVERLAY_REGISTRY` 登记；未登记会抛，而不是静默不渲染 */
  id: string
  /**
   * `first-visit` / `in-room` / `not-in-room` 三种 presence 的挂件由调用方控制
   * 可见性（持久化与房间状态都不在 layout 层）。其余 presence 由本组件按视口判定。
   *
   * 传 `undefined` 等于「可见」——这是刻意的：忘了传的症状是挂件常驻，
   * 那是看得见的；反过来默认隐藏的话，症状是挂件消失，而**没有任何测试会红**。
   */
  visible?: boolean
  children: React.ReactNode
}

/**
 * 把一个挂件放进它声明的槽位。
 *
 * 判定 `presence` 是本组件的职责而不是调用方的——否则注册表里的 `presence`
 * 就只是注释，而 `overlayRegistry.test.ts` 的「同槽位必须互斥」也就无从断言。
 */
export function EdgeItem({ id, visible, children }: EdgeItemProps) {
  const entry = overlayById(id)
  const slots = useContext(SlotContext)
  const viewport = useViewport()

  if (!slots) return null                       // 容器还没就位（SSR / 首帧）
  const target = slots[entry.slot]
  if (!target) return null

  // 视口未判定前不渲染任何依赖视口的挂件：默认某一边会在手机上闪一下桌面版
  if (entry.presence === 'desktop' && (!viewport || viewport.isNarrow)) return null
  if (entry.presence === 'narrow' && (!viewport || !viewport.isNarrow)) return null
  // 首访、房间内外三种 presence 的可见性由调用方给：
  // 首访是 localStorage（持久化归调用方），房间状态在 SceneContext 里——
  // layout 层不该 import Lab 的 context（分层方向单向朝内）。
  // 声明的作用是让门禁能推理互斥，不是让本组件去判。
  if (CALLER_DRIVEN.has(entry.presence) && visible === false) return null

  return createPortal(
    <div
      data-overlay={id}
      style={{
        order: entry.order,
        position: 'relative',
        // 层内 z 由声明表的下标派生，不手写数字。
        // 同槽位的挂件本来就是不重叠的 flex 兄弟，这个 z 只在「面板展开到超出
        // 自己的槽位盒」时才起作用——但声明它是免费的，而漏了它的症状
        // （某个面板被另一个槽位的挂件压住）只在特定宽度下出现。
        zIndex: zOfLayer(entry.layer),
        // 按声明，不要无条件 'auto'。第一版无条件 auto，把入口页那条提示
        // （它自己写着 none）盖掉，主按钮真的点不动了——实测点击不跳转。
        pointerEvents: entry.interactive ? 'auto' : 'none',
      }}
    >
      {children}
    </div>,
    target,
  )
}
