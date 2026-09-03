import { toDoorFrame } from './projects/scene'
import type { RoomDefinition } from './types'

/**
 * Projects —— 「深夜实验室」（ADR 20260903140619）。
 *
 * 修的是审计 A4，三个原因叠加：
 *
 * 1. **没有环境几何。** `ROOM_ASSETS.projects` 里 28 张纹理全是显示器/电视/
 *    手机的六个面，没有一张是环境——这个房间的环境从未搭过。
 * 2. **相机取景在错误的坐标系。** 进房后 `gsap.to(camera.position, {x:3, y:-3})`
 *    是**世界坐标**，而塔在门的局部坐标系里（门在右墙，inner group 旋转约
 *    −60°）。算下来相机离塔中心约 13 单位，塔半径 2.2 → 四个物体只有指甲大。
 * 3. **场景级雾洗白。** 走廊的 `fog(15, 60)` 正好从塔的距离开始变米白。
 *
 * 连带决定（同一份 ADR）：去掉 `blog / youtube / tiktok` 平台隐喻，所有项目
 * 统一用显示器载体。纹理从 28 张降到 12 张，顺带偿还 `AGENTS.md` 里登记的
 * 最后一条未修项（每个 MonitorBlock 无条件声明 26 个 loader）。
 *
 * 空间约定（房间局部）：地板 y=−1.75、天花 y=2.75（沿用走廊高度），后墙白板
 * 在 z=−5，圆形工作台中心在原点、8 块显示器排在半径 2.4 的圆周上。
 */
export const projectsRoom: RoomDefinition = {
  id: 'projects',
  doorSlot: 1,
  labelKey: 'projects',

  /**
   * 站在弧形工作台的缺口里（台心），看向后墙。
   *
   * **必须在房间内。** 第一版写的是 `z: 6`，而房间进深 10.5 → 前沿在
   * z=5.25，也就是相机站在房间外面、透过没画的前墙往里看。实机截图一眼
   * 看出来：整间房像个从外面观察的盒子，白板与机柜都挤在画面边缘。
   * 现在 z=1.9 落在台面内圈（2.05）里侧，是「坐在工位上」的视角。
   */
  entryPose: {
    // 门坐标系（房间根 group 的空间）：+Z 指向门外，所以房间内的一切都是负 z。
    // 由桌心坐标 [0, 0.35, 1.9] / [0, 0.05, -2.0] 经 toDoorFrame 换算。
    position: toDoorFrame([0, 0.35, 1.9]),
    target: toDoorFrame([0, 0.05, -2.0]),
    duration: 1.0,
  },

  /**
   * 允许环视工作台与三面墙（白板 / 机柜 / 刻度盘），但不许退到房间外。
   *
   * distance 上限 5.5：相机沿 +Z 退到上限时仍在前沿（5.25）内侧，
   * 否则又回到那个"从外面看盒子"的构图。
   */
  cameraFreedom: {
    azimuth: [-0.75, 0.75],
    polar: [-0.28, 0.22],
    distance: [3.0, 5.5],
  },

  // 封闭房间不需要距离雾
  fog: null,

  ambience: {
    soundId: 'amb_projects',
    // 声源放在右墙机柜处，转身时能听出方向
    position: [5, 0, -2],
    refDistance: 2,
    rolloffFactor: 1.0,
  },

  assets: [
    // 房间外壳复用走廊纹理——同一栋楼里的一间房，零新增下载
    '/textures/corridor/wall_texture.webp',
    '/textures/corridor/ceiling_texture.webp',
    '/textures/corridor/kawalekpodlogi.webp',
    '/textures/corridor/texturadoprogow.webp',
    '/textures/corridor/kratanalampy.webp',
    '/textures/corridor/bokilampy.webp',
    // 显示器六面（sketch + painted）。tv_* 与 phone_* 共 16 张已随平台隐喻一起去掉
    '/textures/studio/monitor_front.webp',
    '/textures/studio/monitor_front_painted.webp',
    '/textures/studio/monitor_back.webp',
    '/textures/studio/monitor_back_painted.webp',
    '/textures/studio/monitor_top.webp',
    '/textures/studio/monitor_top_painted.webp',
    '/textures/studio/monitor_bottom.webp',
    '/textures/studio/monitor_bottom_painted.webp',
    '/textures/studio/monitor_left.webp',
    '/textures/studio/monitor_left_painted.webp',
    '/textures/studio/monitor_right.webp',
    '/textures/studio/monitor_right_painted.webp',
  ],

  tutorial: 'projects_inspect',
  view: () =>
    import('@/components/rooms/projects/ProjectsRoomView').then(m => ({
      default: m.ProjectsRoomView,
    })),
}
