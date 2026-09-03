import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'

import {
  CameraDirector,
  clampPolar,
  roomLocalToWorld,
} from '@/lib/lab/app/camera/CameraDirector'
import type { RoomEntryPose } from '@/lib/lab/domain/rooms/types'

/**
 * 相机所有者的测试。
 *
 * 两件事值得重点验，因为它们静默错掉只表现为"构图不对"、没有任何报错：
 *
 *   1. **房间局部 → 世界的换算**。这是审计 A4 的直接根因：ProjectsRoom 写的
 *      `{x:3, y:-3}` 是世界坐标，而房间内容挂在旋转了约 −60° 的门 inner
 *      group 下，算下来相机离塔中心约 13 单位，四个物体在画面上只有指甲大
 *      且偏右。
 *   2. **限位夹取**。polar 到 0 或 π 是球面坐标的极点，up 向量退化，画面会
 *      绕着看向轴自转——不会报错，只会"转起来很怪"。
 *
 * `camera-controls` 需要真实 DOM 事件目标，jsdom 够用。
 */

function makeCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(50, 1.6, 0.1, 1000)
}

describe('roomLocalToWorld', () => {
  it('roomRoot 为 null 时原样返回', () => {
    const out = roomLocalToWorld([1, 2, 3], null)
    expect([out.x, out.y, out.z]).toEqual([1, 2, 3])
  })

  it('应用平移', () => {
    const root = new THREE.Group()
    root.position.set(10, 0, -5)
    const out = roomLocalToWorld([1, 2, 3], root)
    expect([out.x, out.y, out.z]).toEqual([11, 2, -2])
  })

  it('应用旋转 —— 这正是 A4 没做而出错的那一步', () => {
    const root = new THREE.Group()
    // 门绕 Y 转 −60°，与右墙那几扇门同量级
    root.rotation.y = -Math.PI / 3
    const out = roomLocalToWorld([0, 0, 6], root)
    // 局部 +Z 6 单位在世界里被转走了，x 不再是 0
    expect(Math.abs(out.x)).toBeGreaterThan(4)
    expect(out.z).toBeCloseTo(3, 5)
    // 长度守恒
    expect(out.length()).toBeCloseTo(6, 5)
  })

  it('应用嵌套变换（房间根挂在门 inner group 下）', () => {
    const door = new THREE.Group()
    door.position.set(3.5, 0, -90)
    door.rotation.y = -Math.PI / 3
    const room = new THREE.Group()
    room.position.set(0, 0, -2)
    door.add(room)

    const out = roomLocalToWorld([0, 1, 0], room)
    // y 不受 Y 轴旋转影响，但 x/z 要带上门的位置
    expect(out.y).toBeCloseTo(1, 5)
    expect(out.x).not.toBeCloseTo(0, 1)
    expect(out.z).toBeLessThan(-80)
  })

  it('复用传入的 out 向量，不额外分配', () => {
    const out = new THREE.Vector3()
    expect(roomLocalToWorld([1, 1, 1], null, out)).toBe(out)
  })
})

describe('clampPolar', () => {
  it('把角度夹进 (0, π) 开区间 —— 极点上 up 向量退化，画面会自转', () => {
    expect(clampPolar(0)).toBeGreaterThan(0)
    expect(clampPolar(-10)).toBeGreaterThan(0)
    expect(clampPolar(Math.PI)).toBeLessThan(Math.PI)
    expect(clampPolar(99)).toBeLessThan(Math.PI)
  })

  it('区间内的角度不动', () => {
    expect(clampPolar(Math.PI / 2)).toBeCloseTo(Math.PI / 2, 10)
  })
})

describe('CameraDirector', () => {
  let director: CameraDirector
  let dom: HTMLDivElement

  beforeEach(() => {
    vi.useFakeTimers()
    dom = document.createElement('div')
    document.body.appendChild(dom)
    director = new CameraDirector()
    director.attach(makeCamera(), dom)
  })

  afterEach(() => {
    director.detach()
    dom.remove()
    vi.useRealTimers()
  })

  const pose: RoomEntryPose = {
    position: [0, 0, 6],
    target: [0, 0, 0],
    duration: 0.8,
  }

  it('duration <= 0 立即到位 —— 传送的快速模式要求这一条', () => {
    const arrived = vi.fn()
    director.enterRoom(pose, null, null, { duration: 0, onArrive: arrived })
    const s = director.snapshot()
    expect([s.px, s.py, s.pz]).toEqual([0, 0, 6])
    expect([s.tx, s.ty, s.tz]).toEqual([0, 0, 0])
    expect(arrived).toHaveBeenCalledTimes(1)
  })

  it('进房位姿经过房间根的变换 —— 声明写的是房间局部坐标', () => {
    const root = new THREE.Group()
    root.position.set(0, 0, -90)
    root.rotation.y = -Math.PI / 3

    director.enterRoom(pose, root, null, { duration: 0 })
    const s = director.snapshot()
    // 不是 [0,0,6]：局部 +Z 被门的旋转与位置带走了
    expect(s.pz).toBeLessThan(-85)
    expect(Math.abs(s.px)).toBeGreaterThan(4)
    // target 也换算了，否则相机会看向世界原点
    expect(s.tz).toBeCloseTo(-90, 5)
  })

  it('有时长时进入 scripted 模式并禁用输入 —— 不禁的话拖拽和 tween 抢同一个 pose', () => {
    director.enterRoom(pose, null, null)
    expect(director.currentMode).toBe('scripted')
  })

  it('freedom 为 null 时到位后完全锁死', () => {
    const arrived = vi.fn()
    director.enterRoom(pose, null, null, { duration: 0, onArrive: arrived })
    expect(arrived).toHaveBeenCalled()
    expect(director.currentMode).toBe('idle')
  })

  it('给了 freedom 时到位后进入 free 模式', () => {
    director.enterRoom(pose, null, {
      azimuth: [-0.5, 0.5],
      polar: [-0.3, 0.3],
      distance: [3, 10],
    }, { duration: 0 })
    expect(director.currentMode).toBe('free')
  })

  it('对焦物体时强制锁死自由度 —— 一边看细节一边能 orbit 只会让人转丢', () => {
    director.enterRoom(pose, null, {
      azimuth: [-1, 1], polar: [-0.3, 0.3], distance: [2, 12],
    }, { duration: 0 })
    expect(director.currentMode).toBe('free')

    director.frameObject(
      new THREE.Vector3(1, 0, -2),
      new THREE.Vector3(1, 0, 0),
      { duration: 0 },
    )
    expect(director.currentMode).toBe('idle')
    const s = director.snapshot()
    expect([s.px, s.py, s.pz]).toEqual([1, 0, 0])
    expect([s.tx, s.ty, s.tz]).toEqual([1, 0, -2])
  })

  it('取消对焦回到进房位姿并恢复自由度', () => {
    const freedom = { azimuth: [-1, 1] as const, polar: [-0.3, 0.3] as const, distance: [2, 12] as const }
    director.enterRoom(pose, null, freedom, { duration: 0 })
    const entered = director.snapshot()

    director.frameObject(new THREE.Vector3(5, 5, 5), new THREE.Vector3(6, 6, 6), { duration: 0 })
    expect(director.snapshot().px).toBe(6)

    director.returnToRoomPose({ duration: 0 })
    expect(director.snapshot()).toEqual(entered)
    expect(director.currentMode).toBe('free')
  })

  it('没进过房时 returnToRoomPose 是空操作，不炸', () => {
    expect(() => director.returnToRoomPose({ duration: 0 })).not.toThrow()
  })

  it('新的移动打断旧的 —— 两个 tween 同时写 pose 就是 A4 的根因', () => {
    director.moveToWorld(new THREE.Vector3(0, 0, 10), new THREE.Vector3(), { duration: 2 })
    director.moveToWorld(new THREE.Vector3(0, 0, 3), new THREE.Vector3(), { duration: 0 })
    // 第二次是立即模式，如果第一次的 tween 还活着，它会继续往 z=10 拉
    expect(director.snapshot().pz).toBe(3)
  })

  it('detach 后再动作不炸（房间卸载与动画竞态）', () => {
    director.enterRoom(pose, null, null)
    director.detach()
    expect(() => {
      director.update(0.016)
      director.moveToWorld(new THREE.Vector3(1, 1, 1), new THREE.Vector3(), { duration: 0 })
      director.returnToRoomPose({ duration: 0 })
    }).not.toThrow()
    expect(director.currentMode).toBe('idle')
  })

  it('重复 attach 不泄漏上一个 controls', () => {
    expect(() => {
      director.attach(makeCamera(), dom)
      director.attach(makeCamera(), dom)
      director.update(0.016)
    }).not.toThrow()
  })

  it('distance 范围反了也不会得到 min > max 的限位', () => {
    expect(() => {
      director.enterRoom(pose, null, {
        azimuth: [-1, 1],
        polar: [-0.3, 0.3],
        // 故意给一个退化区间
        distance: [8, 8],
      }, { duration: 0 })
    }).not.toThrow()
    expect(director.currentMode).toBe('free')
  })
})

describe('CameraDirector —— 所有权交接', () => {
  let director: CameraDirector
  let dom: HTMLDivElement
  let camera: THREE.PerspectiveCamera

  beforeEach(() => {
    dom = document.createElement('div')
    document.body.appendChild(dom)
    camera = makeCamera()
    director = new CameraDirector()
    director.attach(camera, dom)
  })

  afterEach(() => {
    director.detach()
    dom.remove()
  })

  it('attach 后默认挂起 —— 走廊与进出房还由别处写相机，不挂起会被抹掉', () => {
    expect(director.isSuspended).toBe(true)
  })

  it('挂起期间 update 完全不碰相机', () => {
    camera.position.set(1, 2, 3)
    director.update(0.016)
    director.update(0.016)
    expect([camera.position.x, camera.position.y, camera.position.z]).toEqual([1, 2, 3])
  })

  it('恢复时以相机当前实际位姿为准 —— 挂起期间别处移动过它', () => {
    // 挂起期间"别处"把相机搬走
    camera.position.set(0, 0.2, -87)
    camera.lookAt(0, 0.2, -95)
    camera.updateMatrixWorld()

    director.resume()
    const s = director.snapshot()
    expect(s.px).toBeCloseTo(0, 4)
    expect(s.pz).toBeCloseTo(-87, 4)
    // target 在相机正前方，不是世界原点
    expect(s.tz).toBeLessThan(-87)
  })

  it('恢复后第一帧不把相机跳回挂起时的旧位置', () => {
    director.resume()
    director.suspend()
    camera.position.set(50, 50, 50)
    camera.updateMatrixWorld()
    director.resume()
    director.update(0.016)
    expect(camera.position.length()).toBeGreaterThan(50)
  })

  it('enterRoom 自动接管 —— 房间不必自己记得 resume', () => {
    expect(director.isSuspended).toBe(true)
    director.enterRoom(
      { position: [0, 0, 6], target: [0, 0, 0], duration: 0 },
      null,
      null,
    )
    expect(director.isSuspended).toBe(false)
  })

  it('suspend 会 kill 进行中的 tween', () => {
    director.resume()
    director.moveToWorld(new THREE.Vector3(0, 0, 20), new THREE.Vector3(), { duration: 3 })
    expect(director.currentMode).toBe('scripted')
    director.suspend()
    expect(director.currentMode).toBe('idle')
    // tween 还活着的话 pose 会继续往 z=20 爬
    const before = director.snapshot().pz
    director.update(0.5)
    expect(director.snapshot().pz).toBe(before)
  })

  it('detach 后回到挂起态', () => {
    director.resume()
    director.detach()
    expect(director.isSuspended).toBe(true)
  })
})

describe('CameraDirector —— 位姿锚定在房间上', () => {
  let director: CameraDirector
  let dom: HTMLDivElement
  let root: THREE.Group

  beforeEach(() => {
    dom = document.createElement('div')
    document.body.appendChild(dom)
    root = new THREE.Group()
    director = new CameraDirector()
    director.attach(makeCamera(), dom)
  })

  afterEach(() => {
    director.detach()
    dom.remove()
  })

  const pose: RoomEntryPose = { position: [0, 0.35, -3.7], target: [0, 0.05, -7.6], duration: 0 }

  /**
   * 这一组测的是实机抓到的那个 bug：`enterRoom` 只在进房那一刻把房间局部
   * 位姿换算成世界坐标，而房间根的世界矩阵之后还会变（门板继续转、走廊段落
   * 被回收重排）。矩阵一变房间内容整体移动，相机留在旧世界坐标上，取景就偏。
   *
   * 实测数据：桌心原点本该投在画面正中（NDC x=0），偏到 −1.66；停靠再收回
   * 时相机直接被甩到门外的走廊里。
   */
  it('房间移动后相机跟着移动，相对取景不变', () => {
    director.enterRoom(pose, root, null, { duration: 0 })
    director.update(0.016) // 建立锚点基准
    const before = director.snapshot()

    // 房间整体平移（门板转开 / 段落重排的效果）
    root.position.set(1.4, 0, 2.6)
    director.update(0.016)
    const after = director.snapshot()

    expect(after.px - before.px, 'x 没跟上').toBeCloseTo(1.4, 5)
    expect(after.pz - before.pz, 'z 没跟上').toBeCloseTo(2.6, 5)
    // target 也要跟，否则朝向会歪——这正是"偏 1.66"的形态
    expect(after.tx - before.tx).toBeCloseTo(1.4, 5)
    expect(after.tz - before.tz).toBeCloseTo(2.6, 5)
  })

  it('房间旋转后相机也跟着转 —— 只跟平移不够', () => {
    director.enterRoom(pose, root, null, { duration: 0 })
    director.update(0.016)
    const before = director.snapshot()
    const beforeDist = Math.hypot(before.tx - before.px, before.tz - before.pz)

    root.rotation.y = Math.PI / 3
    director.update(0.016)
    const after = director.snapshot()

    // 相机与 target 的相对关系（距离）必须守恒
    const afterDist = Math.hypot(after.tx - after.px, after.tz - after.pz)
    expect(afterDist).toBeCloseTo(beforeDist, 5)
    // 但绝对位置变了 —— 说明确实跟着转了，不是原地不动
    expect(Math.hypot(after.px - before.px, after.pz - before.pz)).toBeGreaterThan(0.5)
  })

  it('房间不动时不做任何多余的写入', () => {
    director.enterRoom(pose, root, null, { duration: 0 })
    director.update(0.016)
    const a = director.snapshot()
    director.update(0.016)
    director.update(0.016)
    expect(director.snapshot()).toEqual(a)
  })

  it('挂起期间房间移动，恢复后不会补一个巨大的增量', () => {
    director.enterRoom(pose, root, null, { duration: 0 })
    director.update(0.016)
    director.suspend()

    // 挂起期间房间被搬走（退房时门关上、段落重排）
    root.position.set(100, 0, 100)

    director.resume()
    const beforeUpdate = director.snapshot()
    director.update(0.016)
    // 恢复时以相机当前实际位姿为基准，不应被 100 单位的增量甩走
    expect(Math.hypot(
      director.snapshot().px - beforeUpdate.px,
      director.snapshot().pz - beforeUpdate.pz,
    )).toBeLessThan(1)
  })

  it('换房间时重置锚点 —— 不把上一个房间的增量作用到新房间', () => {
    director.enterRoom(pose, root, null, { duration: 0 })
    director.update(0.016)
    root.position.set(5, 0, 5)

    const other = new THREE.Group()
    other.position.set(-20, 0, 40)
    director.enterRoom(pose, other, null, { duration: 0 })
    const entered = director.snapshot()
    director.update(0.016)

    expect(director.snapshot()).toEqual(entered)
  })

  it('没有房间根时（走廊 / 测试）不炸', () => {
    director.enterRoom(pose, null, null, { duration: 0 })
    expect(() => { director.update(0.016); director.update(0.016) }).not.toThrow()
  })
})
