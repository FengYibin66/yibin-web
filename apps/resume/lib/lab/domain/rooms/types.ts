
import type { AchievementId, DoorSlot, RoomId } from '../ids'

/**
 * 房间声明——每个房间的全部差异集中在一处（ADR 20260903140615）。
 *
 * 取景是**数据**，可以用截图基线锁住；加房间等于加一个文件，不改编排代码。
 */

export type Vec3 = readonly [number, number, number]

/**
 * 进房后的观察位姿。
 *
 * **坐标系是房间自己的局部空间**（房间根 `<group>` 建立的那个），不是世界坐标。
 * 混用是审计 A4 的直接根因：写世界坐标时房间内容挂在旋转约 −60° 的门 inner group
 * 下，实算相机离目标 13 单位，四个物体在画面上只有指甲大。
 *
 * `CameraDirector` 用挂载后房间根的 worldMatrix 做换算（ADR 20260903140617）。
 */
export interface RoomEntryPose {
  position: Vec3
  /** 看向哪里（同样是门局部坐标） */
  target: Vec3
  /** 过渡时长（秒）。传送的快速模式会跳过它 */
  duration: number
}

/**
 * 房间内允许的相机自由度。
 *
 * `null` = 完全锁定（内容是平面构图，转动只会看到边界）。
 * 给出范围时是以 `entryPose` 为中心的受限 orbit。
 */
export interface RoomCameraFreedom {
  /** 水平方位角范围（弧度，相对 entryPose） */
  azimuth: readonly [number, number]
  /** 垂直俯仰范围（弧度，相对 entryPose） */
  polar: readonly [number, number]
  /** 与 target 的距离范围（世界单位） */
  distance: readonly [number, number]
}

/**
 * 房间的雾。
 *
 * `null` = 无雾。这是 A1 / A4「被雾洗白」的修法：走廊的
 * `fog(#f0ece4, 15, 60)` 挂在 Canvas 根上，任何 15 单位外的东西开始变米白
 * ——而 Projects 的塔和 About 的故事内容正好在那个距离。封闭房间不需要距离
 * 雾；开阔房间（About 的天空）需要自己的一套。
 */
export interface RoomFog {
  color: string
  near: number
  far: number
}

/**
 * 房间环境音。
 *
 * **不参与房间 READY 判定**——这是审计 A5 的修法：drei 的
 * `<PositionalAudio>` 走 `useLoader` 会 Suspend，于是 Projects 的 2.35MB 与
 * Contact 的 1.66MB 音频挂在房间的 Suspense 边界里，8 秒加载超时很容易被
 * 音频撑爆。由 AudioMixer 回调式加载（ADR 20260903140618）。
 */
export interface RoomAmbience {
  soundId: string
  /** 声源位置（房间局部坐标），距离衰减以此为中心 */
  position: Vec3
  refDistance: number
  rolloffFactor: number
}

export interface RoomViewProps {
  /** 房间生命周期相位。取代原先 showRoom / isExiting 两个布尔的组合 */
  phase: 'mounting' | 'ready' | 'entered' | 'exiting'
}

export interface RoomDefinition {
  id: RoomId
  /** 走廊里对应哪个门位。门的 Z 坐标由 CORRIDOR_LAYOUT 给出，不在这里重复 */
  doorSlot: DoorSlot
  /** 门牌文案的 i18n key（`content[locale].lab.doors[...]`） */
  labelKey: RoomId
  entryPose: RoomEntryPose
  cameraFreedom: RoomCameraFreedom | null
  fog: RoomFog | null
  ambience: RoomAmbience | null
  /**
   * 本房间真正引用的纹理。
   *
   * 预载表由它派生（不可手写，见 ADR 20260903140615）。
   * `__tests__/roomRegistry.test.ts` 断言它 ⊇ 组件里的 `useTexture` 字面量
   * ——漏声明原先的表现是进房才开始下载，或者干脆少一张贴图（审计 A2：
   * Contact 的云漏了整批云纹理，退化成四个灰矩形）。
   */
  assets: readonly string[]
  /** 进房若干秒后弹出的教程气泡 */
  tutorial: AchievementId | null
  /*
    这里原先还有一个 `view: () => Promise<{ default: ComponentType<RoomViewProps> }>`。

    它已搬到 `components/rooms/registry.ts`（ADR 20260903211338）：为了这一个字段，
    本文件要 `import type { ComponentType } from 'react'`，而五个房间定义各自
    `import('@/components/rooms/...')`——**domain 指向 interface 层**，与
    「依赖方向单向朝内」正好反着，也与 `apps/resume/AGENTS.md` 声称的
    「domain 不感知 React / three / DOM」矛盾。

    房间**是什么**（门位、取景、雾、环境音、资产、教程）留在这里；
    房间**长什么样**归 `components/`。`__tests__/domainPurity.test.ts` 守这条边界。
  */
}
