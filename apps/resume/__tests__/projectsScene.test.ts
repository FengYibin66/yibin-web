import { describe, expect, it } from 'vitest'

import { planSketch } from '@/lib/lab/domain/sketch/plan'
import type { SketchOp } from '@/lib/lab/domain/sketch/types'
import {
  AMBIENT,
  BACK_Z,
  CABINET,
  CABINET_LAMPS,
  CABLES,
  CEILING_Y,
  DESK,
  DIALS,
  FLOOR_Y,
  LAMP,
  MONITOR_DOCK,
  MONITOR_RING,
  ROOM_DEPTH,
  ROOM_ORIGIN_Z,
  ROOM_WIDTH,
  SCREEN_GLOW,
  STICKY_SLOTS,
  WALL_X,
  WHITEBOARD,
  cabinetLampPosition,
  monitorAngle,
  monitorDockPose,
  monitorTransform,
  toDoorFrame,
  wallPanelTransform,
  type WallPanel,
} from '@/lib/lab/domain/rooms/projects/scene'
import { projectsRoom } from '@/lib/lab/domain/rooms/projects'

/**
 * Projects 房间的空间声明。
 *
 * 这个文件的重点不是"坐标等于某个数字"，而是**几何自洽**：
 *
 *   - 陈设在房间里，不穿墙、不埋进地板
 *   - 相机的 entryPose 真的看得到内容（审计 A4 就是这一条错了：相机离塔
 *     13 单位而不是意图的 6，因为取景与布局各用一组魔数）
 *   - 停靠位姿在屏幕前方而不是后方
 *   - LED 的发光平面与草图里画的墨线圆圈对齐（两处独立算的，必须一致）
 *
 * 这些都是"错了不报错，只是看起来不对"的东西，所以必须有断言。
 */

const ALL_PANELS: readonly WallPanel[] = [WHITEBOARD, CABINET, ...DIALS, ...CABLES]

/** 面板四角的房间局部坐标 */
function panelCorners(panel: WallPanel): [number, number, number][] {
  const { position } = wallPanelTransform(panel)
  const hw = panel.width / 2
  const hh = panel.height / 2
  const [x, y, z] = position
  if (panel.face === 'back') {
    return [[x - hw, y - hh, z], [x + hw, y - hh, z], [x - hw, y + hh, z], [x + hw, y + hh, z]]
  }
  return [[x, y - hh, z - hw], [x, y - hh, z + hw], [x, y + hh, z - hw], [x, y + hh, z + hw]]
}

describe('房间外壳', () => {
  it('尺寸与走廊层高一致 —— 这是同一栋楼里的一间房', () => {
    expect(CEILING_Y - FLOOR_Y).toBeCloseTo(4.5, 6)
  })

  it('墙面位置由房间尺寸派生，不是另写一个魔数', () => {
    expect(WALL_X).toBe(ROOM_WIDTH / 2)
    expect(BACK_Z).toBe(-ROOM_DEPTH / 2)
  })
})

describe('显示器环', () => {
  it('单块时摆正中，且在后墙一侧（0° 指 −Z）', () => {
    expect(monitorAngle(0, 1)).toBe(0)
    const t = monitorTransform(0, 1)
    expect(t.position[0]).toBeCloseTo(0, 6)
    // −Z：在观察者前方。写成 +Z 的话它会落在相机与房间中心之间，
    // 从 entryPose 看过去就在脸前挡住整间房（第一版就是这个错）
    expect(t.position[2]).toBeCloseTo(-MONITOR_RING.radius, 6)
  })

  it('全部显示器都在观察者前方（z < 相机 z） —— 背后的看不见', () => {
    // 换到桌心坐标再比（见「进房取景」那一节的说明）
    const camZ = projectsRoom.entryPose.position[2] - ROOM_ORIGIN_Z
    const n = MONITOR_RING.max
    for (let i = 0; i < n; i += 1) {
      expect(monitorTransform(i, n).position[2], `#${i} 在相机背后`).toBeLessThan(camZ)
    }
  })

  it('多块时铺满声明的角度范围', () => {
    const n = 8
    expect(monitorAngle(0, n)).toBeCloseTo(MONITOR_RING.arc[0], 6)
    expect(monitorAngle(n - 1, n)).toBeCloseTo(MONITOR_RING.arc[1], 6)
  })

  it('角度单调递增，不会两块重叠', () => {
    const n = MONITOR_RING.max
    for (let i = 1; i < n; i += 1) {
      expect(monitorAngle(i, n)).toBeGreaterThan(monitorAngle(i - 1, n))
    }
  })

  it('相邻两块的弧长大于显示器宽度 —— 否则物理上互相穿插', () => {
    const n = MONITOR_RING.max
    const step = monitorAngle(1, n) - monitorAngle(0, n)
    const arcLength = step * MONITOR_RING.radius
    expect(arcLength).toBeGreaterThan(MONITOR_RING.width)
  })

  it('全部显示器在房间内且在台面之上', () => {
    const n = MONITOR_RING.max
    for (let i = 0; i < n; i += 1) {
      const { position } = monitorTransform(i, n)
      const [x, y, z] = position
      expect(Math.abs(x), `#${i} 穿墙`).toBeLessThan(WALL_X - MONITOR_RING.width / 2)
      expect(Math.abs(z), `#${i} 穿墙`).toBeLessThan(ROOM_DEPTH / 2 - 0.3)
      expect(y - MONITOR_RING.height / 2, `#${i} 埋进台面`)
        .toBeGreaterThan(DESK.y - 0.05)
      expect(y + MONITOR_RING.height / 2, `#${i} 顶到天花`).toBeLessThan(CEILING_Y)
    }
  })

  it('全部显示器落在台面的环带上 —— 悬空或穿过台心都不行', () => {
    const n = MONITOR_RING.max
    for (let i = 0; i < n; i += 1) {
      const { position } = monitorTransform(i, n)
      const r = Math.hypot(position[0], position[2])
      expect(r, `#${i}`).toBeGreaterThan(DESK.innerRadius)
      expect(r, `#${i}`).toBeLessThan(DESK.outerRadius)
    }
  })

  it('屏幕法线朝房间中心 —— 朝外的话观察者只看到背板', () => {
    const n = 8
    for (let i = 0; i < n; i += 1) {
      const { position, rotationY } = monitorTransform(i, n)
      // 局部 +Z 是屏幕正面；绕 Y 转 rotationY 后，(0,0,1) 变成 (sin, 0, cos)
      const nx = Math.sin(rotationY)
      const nz = Math.cos(rotationY)
      // 从显示器指向中心的向量
      const tx = -position[0]
      const tz = -position[2]
      const dot = nx * tx + nz * tz
      /*
        点积 **> 0** 才是"法线朝向中心"。

        这条断言我第一版写成了 `< 0`——名字说朝内、验的是朝外。旧实现
        （rotationY = angle）恰好朝外，于是测试是绿的，而观察者站在环心
        看到的全是背板。改对基准后这条立刻变红，才发现断言本身反了。
      */
      expect(dot, `#${i} 屏幕朝外了（法线背对观察者）`).toBeGreaterThan(0)
    }
  })
})

describe('进房取景（审计 A4 的那一条）', () => {
  /*
    `entryPose` 是**门坐标系**（原点在门平面、+Z 指向门外），而本文件其余
    坐标是**桌心坐标系**。两者差一个 `ROOM_ORIGIN_Z`，所以比较前必须换算
    ——直接比就是"拿两个坐标系的数字相减"，而那正是 A4 的错误形态。
  */
  const toDesk = (v: readonly [number, number, number]): [number, number, number] =>
    [v[0], v[1], v[2] - ROOM_ORIGIN_Z]

  const position = toDesk(projectsRoom.entryPose.position)
  const target = toDesk(projectsRoom.entryPose.target)

  it('相机在房间内', () => {
    expect(Math.abs(position[0])).toBeLessThan(WALL_X)
    expect(position[1]).toBeGreaterThan(FLOOR_Y)
    expect(position[1]).toBeLessThan(CEILING_Y)
    /*
      相机必须**在房间内**。

      第一版这里写的是 `< ROOM_DEPTH / 2 + 1.5`——太松，于是 z=6 通过了检查，
      而房间前沿在 5.25：相机站在房间外面，透过没画的前墙往里看。实机截图
      里整间房像个从外面观察的盒子。前墙不画是刻意的（观察者从那里进来），
      正因如此这条边界只能靠断言守。
    */
    expect(position[2], '相机在房间外面').toBeLessThan(ROOM_DEPTH / 2)
    expect(position[2], '相机穿到后墙外了').toBeGreaterThan(-ROOM_DEPTH / 2)
  })

  it('cameraFreedom 的最远距离仍在房间内 —— 拉远到房间外就又是"从外面看盒子"', () => {
    const { distance } = projectsRoom.cameraFreedom!
    const [, , tz] = projectsRoom.entryPose.target
    // 最坏情况：沿 +Z 退到上限
    expect(tz + distance[1], '拉到最远时相机出房间了').toBeLessThan(ROOM_DEPTH / 2)
  })

  it('相机站在台面内圈里 —— 这是"坐在工位上"，不是"站在桌子上"', () => {
    const [x, , z] = projectsRoom.entryPose.position
    expect(Math.hypot(x, z - ROOM_ORIGIN_Z), '相机压在台面上')
      .toBeLessThan(DESK.innerRadius)
  })

  it('相机到显示器环的距离在 cameraFreedom 允许的范围内 —— 对不上就是 A4', () => {
    const d = Math.hypot(position[0] - target[0], position[2] - target[2])
    const freedom = projectsRoom.cameraFreedom!
    expect(d).toBeGreaterThanOrEqual(freedom.distance[0])
    expect(d).toBeLessThanOrEqual(freedom.distance[1])
  })

  /*
    ── 取景断言用真投影，不用"横向宽度够不够"的近似 ──

    第一版这里算的是"距离 d 处可见半宽 vs 显示器环最大横向偏移"。那个近似
    忽略了各物体各自的深度，给出的是**假的信心**：它是绿的，而实机上桌心
    原点投在 NDC x=−1.66（画面外）。

    现在直接做透视投影。构图是刚体变换下的不变量——房间整体怎么旋转平移，
    相机与内容的相对关系不变——所以在桌心坐标系里算出的 NDC 就是实机的
    NDC。实机探针验证过这一点：本文件算出的值与浏览器里 `projectRoom` 读到
    的一致。
  */
  const VFOV = 60
  const ASPECT = 16 / 9

  /** 桌心坐标点 → NDC。返回 null 表示在相机背后 */
  function ndc(pt: readonly [number, number, number]): { x: number; y: number } | null {
    // 相机基：看向 target，up=+Y
    const fwd = [target[0] - position[0], target[1] - position[1], target[2] - position[2]]
    const fl = Math.hypot(...fwd)
    const f = fwd.map(v => v / fl)
    // right = normalize(cross(f, up))
    const r0 = [f[1]! * 0 - f[2]! * 1, f[2]! * 0 - f[0]! * 0, f[0]! * 1 - f[1]! * 0]
    const rl = Math.hypot(...r0)
    const r = r0.map(v => v / rl)
    // up' = cross(r, f)
    const u = [
      r[1]! * f[2]! - r[2]! * f[1]!,
      r[2]! * f[0]! - r[0]! * f[2]!,
      r[0]! * f[1]! - r[1]! * f[0]!,
    ]
    const d = [pt[0] - position[0], pt[1] - position[1], pt[2] - position[2]]
    const z = d[0]! * f[0]! + d[1]! * f[1]! + d[2]! * f[2]!
    if (z <= 0) return null
    const x = d[0]! * r[0]! + d[1]! * r[1]! + d[2]! * r[2]!
    const y = d[0]! * u[0]! + d[1]! * u[1]! + d[2]! * u[2]!
    const tanV = Math.tan((VFOV * Math.PI) / 180 / 2)
    return { x: x / z / (tanV * ASPECT), y: y / z / tanV }
  }

  const onScreen = (v: { x: number; y: number } | null) =>
    v !== null && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1

  it('看向的正是房间中心 —— 桌心投在画面正中', () => {
    const c = ndc([0, MONITOR_RING.y, 0])
    expect(c, '桌心在相机背后').not.toBeNull()
    expect(Math.abs(c!.x), `桌心投到 x=${c!.x.toFixed(2)}，不在画面中央`).toBeLessThan(0.15)
  })

  it('全部显示器都在画面内 —— 这是"四个物体只有指甲大且偏右"的反面', () => {
    const n = MONITOR_RING.max
    for (let i = 0; i < n; i += 1) {
      const t = monitorTransform(i, n)
      const v = ndc(t.position)
      expect(onScreen(v), `#${i} 投到 ${v ? `x=${v.x.toFixed(2)}` : '相机背后'}`).toBe(true)
    }
  })

  it('显示器的**左右边缘**也在画面内 —— 只验中心点的话两端会被切掉', () => {
    const n = MONITOR_RING.max
    const half = MONITOR_RING.width / 2
    for (let i = 0; i < n; i += 1) {
      const { position: pp, rotationY } = monitorTransform(i, n)
      // 屏幕平面内的横向单位向量：+Z 绕 Y 转 rotationY 得到法线，
      // 横向就是法线绕 Y 再转 90°
      const sx = Math.cos(rotationY)
      const sz = -Math.sin(rotationY)
      for (const sign of [-1, 1]) {
        const edge: [number, number, number] = [
          pp[0] + sx * half * sign,
          pp[1],
          pp[2] + sz * half * sign,
        ]
        const v = ndc(edge)
        expect(
          onScreen(v),
          `#${i} 的${sign < 0 ? '左' : '右'}缘投到 ${v ? `x=${v.x.toFixed(2)}` : '相机背后'}，被画面切掉了`,
        ).toBe(true)
      }
    }
  })

  it('显示器环左右对称 —— 不对称说明取景偏了', () => {
    const n = MONITOR_RING.max
    const first = ndc(monitorTransform(0, n).position)!
    const last = ndc(monitorTransform(n - 1, n).position)!
    expect(first.x + last.x, `左端 ${first.x.toFixed(2)} 右端 ${last.x.toFixed(2)}`)
      .toBeCloseTo(0, 1)
  })

  it('显示器占画面的比例合理 —— 太小就是 A4 的"指甲大"，太大就贴脸', () => {
    const n = MONITOR_RING.max
    const t = monitorTransform(Math.floor(n / 2), n).position
    const left = ndc([t[0] - MONITOR_RING.width / 2, t[1], t[2]])!
    const right = ndc([t[0] + MONITOR_RING.width / 2, t[1], t[2]])!
    const share = Math.abs(right.x - left.x) / 2 // 占半宽的比例
    expect(share, `中间那块只占画面宽度的 ${(share * 100).toFixed(1)}%`).toBeGreaterThan(0.06)
    expect(share, `中间那块占了画面宽度的 ${(share * 100).toFixed(1)}%，贴脸`).toBeLessThan(0.45)
  })

  it('白板不被显示器挡住 —— 挡住的部分等于没画（第一版下半张图全被遮）', () => {
    const monitorTop = MONITOR_RING.y + MONITOR_RING.height / 2
    const boardBottom = WHITEBOARD.y - WHITEBOARD.height / 2
    expect(
      boardBottom,
      `白板下沿 ${boardBottom.toFixed(2)} 低于显示器上沿 ${monitorTop.toFixed(2)}，` +
      `那一截被挡住了`,
    ).toBeGreaterThan(monitorTop)
  })

  it('白板四角都在画面内 —— 只验中心的话边缘会被切', () => {
    const hw = WHITEBOARD.width / 2
    const hh = WHITEBOARD.height / 2
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const v = ndc([WHITEBOARD.along + dx * hw, WHITEBOARD.y + dy * hh, -ROOM_DEPTH / 2])
      expect(
        onScreen(v),
        `白板角 (${dx},${dy}) 投到 ${v ? `x=${v.x.toFixed(2)} y=${v.y.toFixed(2)}` : '相机背后'}`,
      ).toBe(true)
    }
  })

  it('至少一张便签在画面内 —— 它们承载项目信息', () => {
    const visible = STICKY_SLOTS.filter(slot =>
      onScreen(ndc([slot.along, slot.y, -ROOM_DEPTH / 2])),
    )
    expect(visible.length, '一张便签都看不见').toBeGreaterThan(0)
  })

  it('台灯在画面内 —— 主光源看不见的话光就是"从空气里来"', () => {
    const v = ndc(LAMP.position)
    expect(
      onScreen(v),
      `台灯投到 ${v ? `x=${v.x.toFixed(2)}` : '相机背后'}；` +
      `它是房间主光源，第一版放在侧后方 89°，连转到 azimuth 上限都看不到`,
    ).toBe(true)
  })

  it('机柜与刻度盘在可转到的范围内 —— 声明了却永远看不见等于没声明', () => {
    const { azimuth } = projectsRoom.cameraFreedom!
    // 转到 azimuth 上限时的可视半角
    const tanV = Math.tan((VFOV * Math.PI) / 180 / 2)
    const hHalf = Math.atan(tanV * ASPECT)
    const reach = hHalf + Math.max(Math.abs(azimuth[0]), Math.abs(azimuth[1]))

    for (const panel of [CABINET, ...DIALS]) {
      const { position: pp } = wallPanelTransform(panel)
      const d = [pp[0] - position[0], pp[2] - position[2]]
      // 与视线（−Z）的水平夹角
      const angle = Math.abs(Math.atan2(d[0]!, -d[1]!))
      expect(
        angle,
        `${panel.id} 在 ${((angle * 180) / Math.PI).toFixed(0)}°，` +
        `而最多能转到 ${((reach * 180) / Math.PI).toFixed(0)}°`,
      ).toBeLessThan(reach)
    }
  })

  it('看向的是房间中段而不是地板或天花', () => {
    expect(target[1]).toBeGreaterThan(DESK.y)
    expect(target[1]).toBeLessThan(1.2)
  })

  it('没有雾 —— 走廊那层 fog(15,60) 正好从这个距离开始洗白（A4 的第三个原因）', () => {
    expect(projectsRoom.fog).toBeNull()
  })
})

describe('显示器停靠', () => {
  it('相机停在屏幕与房间中心之间，不是屏幕背后', () => {
    const n = 8
    for (let i = 0; i < n; i += 1) {
      const { position, target } = monitorDockPose(i, n)
      const camR = Math.hypot(position[0], position[2])
      const scrR = Math.hypot(target[0], target[2])
      expect(camR, `#${i} 相机跑到屏幕背后了`).toBeLessThan(scrR)
    }
  })

  it('相机到屏幕的距离等于声明的 distance', () => {
    const n = 6
    for (let i = 0; i < n; i += 1) {
      const { position, target } = monitorDockPose(i, n)
      const d = Math.hypot(target[0] - position[0], target[2] - position[2])
      expect(d, `#${i}`).toBeCloseTo(MONITOR_DOCK.distance, 5)
    }
  })

  it('停靠位置仍在房间内', () => {
    const n = MONITOR_RING.max
    for (let i = 0; i < n; i += 1) {
      const { position } = monitorDockPose(i, n)
      expect(Math.abs(position[0]), `#${i}`).toBeLessThan(WALL_X)
      expect(position[1]).toBeGreaterThan(FLOOR_Y)
    }
  })

  it('停靠目标就是那块显示器的屏幕位置', () => {
    const n = 5
    for (let i = 0; i < n; i += 1) {
      const dock = monitorDockPose(i, n)
      const mon = monitorTransform(i, n)
      expect(dock.target[0]).toBeCloseTo(mon.position[0], 5)
      expect(dock.target[2]).toBeCloseTo(mon.position[2], 5)
    }
  })
})

describe('墙面陈设', () => {
  it('每块面板都贴在自己声明的那面墙上（离墙量 = 0.02 + lift）', () => {
    for (const panel of ALL_PANELS) {
      const { position } = wallPanelTransform(panel)
      const off = 0.02 + (panel.lift ?? 0)
      if (panel.face === 'back') expect(position[2], panel.id).toBeCloseTo(BACK_Z + off, 6)
      if (panel.face === 'left') expect(position[0], panel.id).toBeCloseTo(-WALL_X + off, 6)
      if (panel.face === 'right') expect(position[0], panel.id).toBeCloseTo(WALL_X - off, 6)
    }
  })

  it('在墙面上重叠的面板必须有不同的离墙量 —— 同深度会 z-fighting 闪', () => {
    const back = ALL_PANELS.filter(p => p.face === 'back')
    const span = (p: WallPanel) => ({
      a0: p.along - p.width / 2, a1: p.along + p.width / 2,
      y0: p.y - p.height / 2, y1: p.y + p.height / 2,
      off: 0.02 + (p.lift ?? 0),
    })
    for (let i = 0; i < back.length; i += 1) {
      for (let j = i + 1; j < back.length; j += 1) {
        const A = span(back[i]!)
        const B = span(back[j]!)
        const overlaps = A.a0 < B.a1 && B.a0 < A.a1 && A.y0 < B.y1 && B.y0 < A.y1
        if (!overlaps) continue
        expect(
          A.off,
          `${back[i]!.id} 与 ${back[j]!.id} 重叠但离墙量相同`,
        ).not.toBeCloseTo(B.off, 6)
      }
    }
  })

  it('面板离墙有间隙 —— 共面会 z-fighting 闪烁', () => {
    for (const panel of ALL_PANELS) {
      const { position } = wallPanelTransform(panel)
      const dist = panel.face === 'back'
        ? Math.abs(position[2] - BACK_Z)
        : Math.abs(Math.abs(position[0]) - WALL_X)
      expect(dist, panel.id).toBeGreaterThan(0)
    }
  })

  it('侧墙面板旋转 90° —— 不转的话它们是侧着看不见的薄片', () => {
    for (const panel of ALL_PANELS) {
      const { rotation } = wallPanelTransform(panel)
      if (panel.face === 'left') expect(rotation[1], panel.id).toBeCloseTo(Math.PI / 2, 6)
      if (panel.face === 'right') expect(rotation[1], panel.id).toBeCloseTo(-Math.PI / 2, 6)
      if (panel.face === 'back') expect(rotation[1], panel.id).toBe(0)
    }
  })

  it('所有面板与便签位都在墙面范围内，不越出房间', () => {
    const panels: Pick<WallPanel, 'face' | 'along' | 'y' | 'width' | 'height' | 'tilt' | 'id'>[] =
      [...ALL_PANELS, ...STICKY_SLOTS]
    for (const panel of panels) {
      for (const [x, y, z] of panelCorners(panel as WallPanel)) {
        expect(y, `${panel.id} 埋进地板`).toBeGreaterThan(FLOOR_Y)
        expect(y, `${panel.id} 穿过天花`).toBeLessThan(CEILING_Y)
        expect(Math.abs(x), `${panel.id} 越出侧墙`).toBeLessThanOrEqual(WALL_X + 0.001)
        expect(Math.abs(z), `${panel.id} 越出前后墙`).toBeLessThanOrEqual(ROOM_DEPTH / 2 + 0.001)
      }
    }
  })

  it('便签不被显示器挡住 —— 它们承载项目信息，挡住等于没写', () => {
    const monitorTop = MONITOR_RING.y + MONITOR_RING.height / 2
    for (const slot of STICKY_SLOTS) {
      expect(
        slot.y - slot.height / 2,
        `${slot.id} 下沿 ${(slot.y - slot.height / 2).toFixed(2)} 低于显示器上沿 ${monitorTop.toFixed(2)}`,
      ).toBeGreaterThan(monitorTop)
    }
  })

  it('便签互不重叠', () => {
    for (let i = 0; i < STICKY_SLOTS.length; i += 1) {
      for (let j = i + 1; j < STICKY_SLOTS.length; j += 1) {
        const a = STICKY_SLOTS[i]!
        const b = STICKY_SLOTS[j]!
        const overlaps =
          Math.abs(a.along - b.along) < (a.width + b.width) / 2 &&
          Math.abs(a.y - b.y) < (a.height + b.height) / 2
        expect(overlaps, `${a.id} 与 ${b.id} 重叠`).toBe(false)
      }
    }
  })

  it('白板与便签不重叠 —— 便签是贴在白板旁边的墙上，不是压在白板上', () => {
    const board = { min: WHITEBOARD.along - WHITEBOARD.width / 2, max: WHITEBOARD.along + WHITEBOARD.width / 2 }
    for (const slot of STICKY_SLOTS) {
      const min = slot.along - slot.width / 2
      expect(min, `${slot.id} 压在白板上`).toBeGreaterThan(board.max - 0.001)
    }
  })

  it('面板的世界宽高比与它的纹理宽高比一致 —— 不一致手绘线条会被拉扁', () => {
    for (const panel of ALL_PANELS) {
      const world = panel.width / panel.height
      const tex = panel.sketch.size.width / panel.sketch.size.height
      expect(world, `${panel.id}：世界 ${world.toFixed(2)} vs 纹理 ${tex.toFixed(2)}`)
        .toBeCloseTo(tex, 1)
    }
  })
})

describe('机柜 LED', () => {
  it('灯位数与草图声明一致', () => {
    const { slots, lampsPerSlot } = CABINET.sketch as { slots: number; lampsPerSlot: number }
    expect(CABINET_LAMPS).toHaveLength(slots * lampsPerSlot)
  })

  it('发光平面与草图里画的墨线圆圈对齐 —— 两处独立算的，错开就露馅', () => {
    const ops = planSketch(CABINET.sketch)
    const circles = ops.filter(o => o.kind === 'ellipse') as Extract<SketchOp, { kind: 'ellipse' }>[]
    const { width: tw, height: th } = CABINET.sketch.size
    expect(circles).toHaveLength(CABINET_LAMPS.length)

    // 两边都按"归一化到纹理尺寸"比较
    const fromSketch = circles
      .map(c => [c.cx / tw, c.cy / th] as [number, number])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    const fromScene = CABINET_LAMPS
      .map(l => [l[0], l[1]] as [number, number])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])

    for (const [i, expectedPos] of fromSketch.entries()) {
      expect(fromScene[i]![0], `灯 ${i} 的 u`).toBeCloseTo(expectedPos[0], 2)
      expect(fromScene[i]![1], `灯 ${i} 的 v`).toBeCloseTo(expectedPos[1], 2)
    }
  })

  it('LED 的房间局部坐标都在机柜面板范围内', () => {
    const { position } = wallPanelTransform(CABINET)
    for (const [i, lamp] of CABINET_LAMPS.entries()) {
      const [x, y, z] = cabinetLampPosition(lamp)
      expect(Math.abs(x - position[0]), `灯 ${i} 离墙太远`).toBeLessThan(0.1)
      expect(Math.abs(y - position[1]), `灯 ${i} 越出高度`).toBeLessThanOrEqual(CABINET.height / 2)
      expect(Math.abs(z - position[2]), `灯 ${i} 越出宽度`).toBeLessThanOrEqual(CABINET.width / 2)
    }
  })

  it('LED 在墙内侧（x 比墙面小） —— 在外侧就看不见了', () => {
    for (const lamp of CABINET_LAMPS) {
      expect(cabinetLampPosition(lamp)[0]).toBeLessThan(WALL_X)
    }
  })
})

describe('灯光', () => {
  it('台灯在房间内、台面之上', () => {
    const [x, y, z] = LAMP.position
    expect(Math.abs(x)).toBeLessThan(WALL_X)
    expect(Math.abs(z)).toBeLessThan(ROOM_DEPTH / 2)
    expect(y).toBeGreaterThan(DESK.y)
    expect(y).toBeLessThan(CEILING_Y)
  })

  it('台灯落在台面环带上，不悬空在台心', () => {
    const r = Math.hypot(LAMP.position[0], LAMP.position[2])
    expect(r).toBeGreaterThan(DESK.innerRadius)
    expect(r).toBeLessThan(DESK.outerRadius)
  })

  it('台灯照得到整个房间宽度 —— 距离不够会留下死黑的角', () => {
    expect(LAMP.distance).toBeGreaterThan(ROOM_WIDTH / 2)
  })

  it('环境光压得很低 —— 这是"深夜"，靠台灯造型', () => {
    expect(AMBIENT.intensity).toBeLessThan(1)
  })

  it('屏幕冷光单个很弱 —— 8 块加起来才是一屋子屏幕的量', () => {
    expect(SCREEN_GLOW.intensity * MONITOR_RING.max).toBeLessThan(LAMP.intensity)
  })

  it('屏幕光源在屏幕前方，不会被自己的板子挡住', () => {
    expect(SCREEN_GLOW.forwardOffset).toBeGreaterThan(MONITOR_RING.depth / 2)
  })
})

describe('工作台', () => {
  it('是个环带，不是实心圆盘', () => {
    expect(DESK.innerRadius).toBeGreaterThan(0)
    expect(DESK.outerRadius).toBeGreaterThan(DESK.innerRadius)
  })

  it('台面在地板与观察视高之间', () => {
    expect(DESK.y).toBeGreaterThan(FLOOR_Y)
    expect(DESK.y).toBeLessThan(projectsRoom.entryPose.position[1])
  })

  it('缺口朝门，能"走进去"', () => {
    expect(DESK.gap).toBeGreaterThan(0)
    expect(DESK.gap).toBeLessThan(Math.PI)
  })

  it('台面不穿墙', () => {
    expect(DESK.outerRadius).toBeLessThan(WALL_X)
    expect(DESK.outerRadius).toBeLessThan(ROOM_DEPTH / 2)
  })
})

describe('房间声明与空间声明一致', () => {
  it('环境音的声源在机柜那一侧 —— 转身时能听出方向', () => {
    const ambience = projectsRoom.ambience!
    const { position } = wallPanelTransform(CABINET)
    // 同一侧（x 同号）且量级相近
    expect(Math.sign(ambience.position[0])).toBe(Math.sign(position[0]))
  })

  it('环境音声源在房间内', () => {
    const [x, y, z] = projectsRoom.ambience!.position
    expect(Math.abs(x)).toBeLessThanOrEqual(WALL_X)
    expect(y).toBeGreaterThan(FLOOR_Y)
    expect(Math.abs(z)).toBeLessThanOrEqual(ROOM_DEPTH / 2)
  })

  it('不再声明电视与手机的纹理 —— 平台隐喻已去掉（同一份 ADR 的连带决定）', () => {
    for (const asset of projectsRoom.assets) {
      expect(asset, `${asset} 是平台隐喻的残留`).not.toMatch(/\/(tv|phone)_/)
    }
  })
})

describe('两个坐标系的关系', () => {
  it('toDoorFrame 只平移 z，不动 x/y', () => {
    const [x, y, z] = toDoorFrame([1.5, 2.5, 3.5])
    expect(x).toBe(1.5)
    expect(y).toBe(2.5)
    expect(z).toBeCloseTo(3.5 + ROOM_ORIGIN_Z, 10)
  })

  it('门坐标系里房间整体在 z 负半轴 —— +Z 是门外的走廊', () => {
    // 房间最靠门的那一面
    const front = toDoorFrame([0, 0, ROOM_DEPTH / 2])
    expect(front[2], '房间前沿伸到门外去了').toBeLessThan(0)
    const back = toDoorFrame([0, 0, -ROOM_DEPTH / 2])
    expect(back[2]).toBeLessThan(front[2])
  })

  it('前沿与门平面之间留了间隙 —— 共面会与门几何打架', () => {
    const frontZ = toDoorFrame([0, 0, ROOM_DEPTH / 2])[2]
    expect(Math.abs(frontZ), '前沿与门平面共面').toBeGreaterThan(0.1)
  })

  it('entryPose 在门坐标系里是负 z —— 正数就是站在走廊里（第一版的 bug）', () => {
    expect(
      projectsRoom.entryPose.position[2],
      '相机在门外的走廊里：实机探针读到它在世界 x=1.61，而走廊墙在 3.5',
    ).toBeLessThan(0)
    expect(projectsRoom.entryPose.target[2]).toBeLessThan(0)
  })

  it('全部墙面陈设换到门坐标后也在负半轴', () => {
    for (const panel of ALL_PANELS) {
      const { position } = wallPanelTransform(panel)
      expect(toDoorFrame(position)[2], panel.id).toBeLessThan(0)
    }
  })
})
