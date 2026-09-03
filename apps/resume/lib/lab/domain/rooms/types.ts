import type { ComponentType } from 'react'

import type { AchievementId, DoorSlot, RoomId } from '../ids'

/**
 * 房间声明 —— 每个房间的全部差异集中在一处。
 *
 * 加它的原因（ADR 20260903140615）：房间之间「谁动相机、动到哪、有没有雾、
 * 环境音怎么放、要哪些纹理」原先散落在各房间组件里，结果是同一件事有五种
 * 做法、四个房间三种完成度：
 *
 * - `PublicationsRoom` 有专门的 `usePublicationBrowseCamera`，所以取景正确
 * - `ProjectsRoom` 用**世界坐标** tween，而塔在门的局部坐标系里 → 四个物体
 *   在画面上只有指甲大且偏右（审计 A4）
 * - `AboutRoom` 与 `ContactRoom` 根本没有房间级相机 → 内容在取景外，Contact
 *   的留言纸（房间唯一的 CTA）用户根本看不到（审计 A1 / A3）
 *
 * 声明化之后，取景变成**数据**，可以用 Playwright 截图基线锁住；加房间等于
 * 加一个文件，不改任何编排代码。
 */

export type Vec3 = readonly [number, number, number]

/**
 * 进房后的观察位姿。
 *
 * **坐标系是房间自己的局部空间**（房间根 `<group>` 建立的那个），不是世界
 * 坐标系。这一点是审计 A4 的直接根因：`ProjectsRoom` 写的
 * `gsap.to(camera.position, { x: 3, y: -3 })` 是**世界坐标**，而房间内容挂在
 * 门的 inner group 下（右墙的门整体旋转约 −60°），算下来相机离塔中心约 13
 * 单位——于是四个物体在画面上只有指甲大且偏右。
 *
 * 选房间局部空间而不是门局部空间，是因为写房间的人思考的就是"相机站在塔前
 * 6 单位、看向塔中段"，而不是"门旋转后的第三象限"。CameraDirector 用挂载后
 * 的房间根 group 的 worldMatrix 做换算（ADR 20260903140617）。
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
  /**
   * 视图组件（interface 层），懒加载。
   *
   * Gallery 是一个执行 `router.push('/gallery')` 的空组件——这样编排代码里
   * 所有 `if (roomId === 'gallery')` 特例分支就都消失了，它的 `entryPose`
   * 仍然生效（相机照常对齐门）。
   */
  view: () => Promise<{ default: ComponentType<RoomViewProps> }>
}
