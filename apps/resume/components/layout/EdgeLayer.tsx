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
 * 屏角挂件的**唯一** `position: fixed` 写者（ADR 20260909182319），由
 * `__tests__/overlayOwnership.test.ts` 棘轮守着。
 *
 * `EdgeLayerRoot` 渲染九个 flex 容器（一个槽位一个），`EdgeItem` 把自己 portal
 * 进去。于是同槽位的占位者是 flex **兄弟**而不是各自绝对定位——这是「几何上
 * 不可能重叠」的实现方式，光把坐标收到一处并不能做到。
 *
 * 槽位内次序用 CSS `order` 从注册表读：portal 的挂载顺序不确定。
 */

/** 由调用方经 `visible` 决定可见性的 presence（本组件判不了，见 EdgeItemProps） */
const CALLER_DRIVEN = new Set<OverlayPresence>(['first-visit', 'in-room', 'not-in-room'])

type SlotElements = Partial<Record<EdgeSlot, HTMLDivElement | null>>

const SlotContext = createContext<SlotElements | null>(null)

function slotStyle(slot: EdgeSlot, isNarrow: boolean): React.CSSProperties {
  const { row, col, direction } = EDGE_SLOTS[slot]
  const inset = isNarrow ? SLOT_INSET.narrow : SLOT_INSET.wide
  // 一律叠 safe-area（刘海屏的左右、手势条的底部）：不叠只在真机上看得见，
  // 模拟器与 headless 都不复现
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
    // 两端各用自己那一侧的 safe-area：刘海屏横屏左右缺口不一样
    style.left = hLeft
    style.right = hRight
    style.justifyContent = 'space-between'
    // 宽度不够时挤，而不是把兄弟推出视口
    style.minWidth = 0
  } else if (col === 'left') style.left = h
  else if (col === 'right') style.right = h
  else {
    // 到这里 col 只能是 'center'；声明表里没有 middle-center 槽位，
    // 所以这里不需要按 row 分支（写了 tsc 会报 TS2367）
    style.left = '50%'
    style.transform = 'translateX(-50%)'
  }

  return style
}

const ALL_SLOTS = Object.keys(EDGE_SLOTS) as EdgeSlot[]

/**
 * 挂在页面根上，渲染全部槽位容器。每个页面**最多一个**。
 * 没有 `EdgeItem` 时是一层完全透明、不吃点击的 div。
 */
export function EdgeLayerRoot({ children }: { children?: React.ReactNode }) {
  const viewport = useViewport()
  const refs = useRef<SlotElements>({})
  // portal 的目标必须在 EdgeItem 渲染时已存在，所以让子树等容器就位后再挂载
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
   * `first-visit` / `in-room` / `not-in-room` 的可见性由调用方给（持久化与房间
   * 状态都不在 layout 层）。其余 presence 由本组件按视口判定。
   *
   * `undefined` 等于可见：忘了传的症状是挂件常驻（看得见），
   * 反过来默认隐藏的症状是挂件消失，而没有任何测试会红。
   */
  visible?: boolean
  children: React.ReactNode
}

/**
 * 把一个挂件放进它声明的槽位。
 *
 * 判定 `presence` 是本组件的职责而不是调用方的——否则注册表里的 `presence`
 * 就只是注释，门禁的「同槽位必须互斥」也就无从断言。
 */
export function EdgeItem({ id, visible, children }: EdgeItemProps) {
  const entry = overlayById(id)
  const slots = useContext(SlotContext)
  const viewport = useViewport()

  if (!slots) return null                       // 容器还没就位（SSR / 首帧）
  const target = slots[entry.slot]
  if (!target) return null

  // 视口未判定前不渲染依赖视口的挂件：默认某一边会在手机上闪一下桌面版
  if (entry.presence === 'desktop' && (!viewport || viewport.isNarrow)) return null
  if (entry.presence === 'narrow' && (!viewport || !viewport.isNarrow)) return null
  if (CALLER_DRIVEN.has(entry.presence) && visible === false) return null

  return createPortal(
    <div
      data-overlay={id}
      style={{
        order: entry.order,
        position: 'relative',
        zIndex: zOfLayer(entry.layer),
        // 按声明，不要无条件 'auto'：那会让写着 `none` 的提示真的挡住底下的按钮
        pointerEvents: entry.interactive ? 'auto' : 'none',
      }}
    >
      {children}
    </div>,
    target,
  )
}
