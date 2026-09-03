/**
 * 相机的唯一所有者（ADR 20260903140617）。
 *
 * ## 为什么需要一个所有者
 *
 * 「房间转场的相机动画由 `DoorSection` 统一编排，房间组件只提供目标 pose」
 * 这条约定在代码里被违反了四次（ProjectsRoom / TeleportRoom /
 * CorridorDecorations / 各房间自起 tween）。后果不是"风格不统一"，而是**两个
 * tween 同时写同一个 `camera.position`**：gsap 的后一个 tween 会接管属性，
 * 前一个继续跑但被覆盖，于是相机停在两个目标之间的某处。审计 A4（Projects
 * 房间四个物体只有指甲大且偏右）正是这么来的——房间自己写的是**世界坐标**
 * `{x:3, y:-3}`，而房间内容挂在旋转了约 −60° 的门 inner group 下。
 *
 * 约定靠不住，所以换成机制：写相机的入口只有这个类，
 * `__tests__/cameraOwnership.test.ts` 用 grep 守住。
 *
 * ## 分层
 *
 * - 位姿**声明**在 domain（`RoomDefinition.entryPose`，房间局部坐标）
 * - 换算与插值在这里（app 层）
 * - 底层 orbit / 阻尼 / 限位交给 `camera-controls`（yomotsu，MIT）
 *
 * 不自己搓 orbit 的理由：受限 orbit 要处理球面坐标的极点退化、阻尼、
 * 触摸双指缩放、以及"限位边界上不要抖"——这些 `camera-controls` 都做过了。
 *
 * ## 两种模式
 *
 * - **scripted**：gsap 插值 pose，每帧无过渡地推给 controls。用于进房、
 *   对焦、退房。时长由声明给（`entryPose.duration`），缓动与全站一致
 *   （`power2.inOut`），所以不用 camera-controls 自己那套指数平滑
 *   ——后者只有 `smoothTime`，给不出确定的时长。
 * - **free**：controls 直接吃输入，限位由 `RoomCameraFreedom` 给。
 *   `freedom` 为 null 的房间完全锁死（内容是平面构图，转动只会看到边界）。
 */
import CameraControls from 'camera-controls'
import gsap from 'gsap'
import * as THREE from 'three'

import type { RoomCameraFreedom, RoomEntryPose } from '@/lib/lab/domain/rooms/types'

// camera-controls 只需要 three 的一小部分，按官方建议做子集注入
CameraControls.install({
  THREE: {
    Vector2: THREE.Vector2,
    Vector3: THREE.Vector3,
    Vector4: THREE.Vector4,
    Quaternion: THREE.Quaternion,
    Matrix4: THREE.Matrix4,
    Spherical: THREE.Spherical,
    Box3: THREE.Box3,
    Sphere: THREE.Sphere,
    Raycaster: THREE.Raycaster,
  },
})

export type CameraMode = 'idle' | 'scripted' | 'free'

export interface MoveOptions {
  /** 秒。0 或负数表示立即到位（传送的快速模式） */
  duration?: number
  ease?: string
  onArrive?: () => void
}

const _pos = new THREE.Vector3()
const _tgt = new THREE.Vector3()
/*
  同步用的独立暂存量。

  **不能复用 `_pos` / `_tgt`**：`enterRoom` 先把换算好的位姿放进它们，接着调
  `resume()` → `syncControlsFromCamera()`，后者若也用这两个就会把前者刚算好的
  值覆盖掉——然后 `moveToWorld(_pos, _tgt)` 收到的是相机当前位姿，房间的
  entryPose 被静默丢弃。（这个别名 bug 是被 cameraDirector 的测试抓出来的，
  症状恰好和 A4 一样："进房了但取景不对"。）
*/
const _syncPos = new THREE.Vector3()
const _syncTgt = new THREE.Vector3()
const _deltaMatrix = new THREE.Matrix4()

/**
 * 房间局部 → 世界。
 *
 * 房间内容挂在门的 inner group 下（右墙的门整体旋转约 −60°），所以房间
 * 局部坐标里的 `{x:0,y:0,z:6}` 在世界里不是"往前 6 单位"。用挂载后房间根
 * group 的 `matrixWorld` 换算——这也是为什么 `enterRoom` 要拿到 `roomRoot`
 * 而不只是 pose。
 *
 * 导出它是为了让测试能独立验换算，不必起整个 R3F。
 */
export function roomLocalToWorld(
  local: readonly [number, number, number],
  roomRoot: THREE.Object3D | null,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  out.set(local[0], local[1], local[2])
  if (!roomRoot) return out
  roomRoot.updateWorldMatrix(true, false)
  return out.applyMatrix4(roomRoot.matrixWorld)
}

export class CameraDirector {
  private controls: CameraControls | null = null
  private camera: THREE.PerspectiveCamera | null = null

  /** 当前位姿。scripted 模式下由 gsap 插值，free 模式下由 controls 回填 */
  private readonly pose = {
    px: 0, py: 0, pz: 0,
    tx: 0, ty: 0, tz: 0,
  }

  private tween: gsap.core.Tween | null = null
  private mode: CameraMode = 'idle'
  private readonly lean = { pitch: 0, bank: 0 }

  /**
   * 默认挂起 —— 这一点很关键。
   *
   * `controls.update()` 每帧都把内部位姿写回相机，**`enabled` 只关输入、
   * 不关姿态应用**。所以只要 controls 在跑，任何别处对 `camera.position` 的
   * 写入都会在同一帧被它抹掉。走廊由 `useCorridorCamera` 的导轨驱动、进出房
   * 由 `DoorSection` 编排，两者都还直接写相机（见 cameraOwnership 白名单）。
   *
   * 于是所有权是**显式交接**的：默认挂起，房间进房时 `resume()` 接管，
   * 退房前 `suspend()` 交还。挂起期间 `update()` 直接返回，controls 不碰相机。
   */
  private suspended = true

  /** 退房 / 取消对焦时回到哪 —— 进房时记下的房间位姿（世界坐标） */
  private roomPose: { px: number; py: number; pz: number; tx: number; ty: number; tz: number } | null = null
  private roomFreedom: RoomCameraFreedom | null = null
  /**
   * 进房时记下的房间根。
   *
   * 保留它不只是为了 `projectRoom` 调试——相机的位姿**锚定在这个节点上**，
   * 见 `followAnchor()`。
   */
  private roomRoot: THREE.Object3D | null = null
  /** 上一帧房间根的世界矩阵，用于算增量 */
  private readonly anchorMatrix = new THREE.Matrix4()
  private anchorValid = false

  // ── 生命周期 ──────────────────────────────────────────────────────────────

  attach(camera: THREE.PerspectiveCamera, dom: HTMLElement): void {
    if (this.controls) this.detach()
    this.camera = camera
    const controls = new CameraControls(camera, dom)
    // 阻尼：手感与 Lab 其余动画（gsap power2）接近，不要弹
    controls.smoothTime = 0.18
    controls.draggingSmoothTime = 0.08
    // 右键拖拽平移在受限房间里没有意义，只会把构图推歪
    controls.mouseButtons.right = CameraControls.ACTION.NONE
    controls.mouseButtons.middle = CameraControls.ACTION.NONE
    controls.touches.two = CameraControls.ACTION.TOUCH_ZOOM
    controls.touches.three = CameraControls.ACTION.NONE
    this.controls = controls
    controls.enabled = false // 默认挂起，见 `suspended` 的注释
    this.syncPoseFromControls()
  }

  detach(): void {
    this.tween?.kill()
    this.tween = null
    this.controls?.dispose()
    this.controls = null
    this.camera = null
    this.mode = 'idle'
    this.roomPose = null
    this.roomFreedom = null
    this.roomRoot = null
    this.anchorValid = false
    this.lean.pitch = 0
    this.lean.bank = 0
    this.suspended = true
  }

  /**
   * 由唯一的 `useFrame` 调用（`components/lab/CameraRig.tsx`）。
   *
   * 顺序有讲究：`controls.update()` 内部会 `camera.lookAt(target)`，**即使
   * `enabled` 为 false 也照做**（`enabled` 只关输入，不关姿态应用）。所以
   * lean 必须在它之后施加，否则每帧都被 lookAt 抹掉——这也正是"相机的整帧
   * 写序列由所有者持有"的意义。
   */
  update(delta: number): void {
    if (this.suspended) return
    this.followAnchor()
    this.controls?.update(delta)
    if (this.mode === 'free') this.syncPoseFromControls()
    this.applyLean()
  }

  /**
   * 附加的俯仰 / 侧倾，每帧叠在朝向之上。
   *
   * About 房间的飞行有一个随滚动速度变化的"探身"效果，原先写成
   * `camera.rotation.x = pitch; camera.rotation.z = bank`——那是**绝对赋值**，
   * 会把 controls 算出来的朝向整个替换掉（在只有一个写者的世界里恰好能用，
   * 因为那时相机总是朝正前方）。改成相对旋转后语义更准：在当前朝向基础上
   * 探身，而不是覆盖当前朝向。
   *
   * 单位是弧度。两个都传 0 = 取消。
   */
  setLean(pitch: number, bank: number): void {
    this.lean.pitch = pitch
    this.lean.bank = bank
  }

  /**
   * 交还相机。挂起期间本类完全不碰相机，别处可以自由写。
   *
   * 会 kill 进行中的 tween：挂起后还继续插值 `this.pose` 却不推给 controls
   * 是纯浪费，恢复时又要重新同步。
   */
  suspend(): void {
    this.tween?.kill()
    this.tween = null
    this.mode = 'idle'
    this.suspended = true
    // 挂起期间房间可能移动，恢复时要重新取基准而不是补一个巨大的增量
    this.anchorValid = false
    if (this.controls) this.controls.enabled = false
  }

  /**
   * 接管相机。
   *
   * 必须先把 controls 的内部状态同步到相机**当前实际位姿**——挂起期间别处
   * 把相机移走了，controls 记的还是挂起那一刻的值，不同步的话恢复第一帧会
   * 猛地跳回去。
   */
  resume(): void {
    this.suspended = false
    this.syncControlsFromCamera()
  }

  get isSuspended(): boolean {
    return this.suspended
  }

  get currentMode(): CameraMode {
    return this.mode
  }

  /**
   * 当前位姿快照。
   *
   * 显式列字段而不是 `{ ...this.pose }`：gsap 会在被 tween 的对象上挂一个
   * `_gsap` 属性，它自身循环引用，扩展进来会让 `JSON.stringify(snapshot())`
   * 直接抛 "Converting circular structure to JSON"。
   */
  snapshot(): { px: number; py: number; pz: number; tx: number; ty: number; tz: number } {
    const { px, py, pz, tx, ty, tz } = this.pose
    return { px, py, pz, tx, ty, tz }
  }

  /**
   * 相机对象**实际**的世界位姿。
   *
   * 与 `snapshot()`（本类想要的位姿）分开报，是为了能发现"别人也在写相机"：
   * 两者不一致就说明同一帧里有另一个写者在 `controls.update()` 之后覆盖了
   * 朝向。相机取景错了不报错，只能靠这种对照发现。
   */
  /**
   * 把一个**世界坐标**点投到 NDC（−1..1）。
   *
   * 调试用。3D 里"东西没画在我以为的地方"不报错，而从截图像素反推角度极
   * 不可靠——做 Projects 房间时我照那条路走，得出"相机被别人转了 30°"的
   * 错误结论，加探针才发现相机位姿零误差。有了这个就能直接问"白板中心落在
   * 画面哪里"。
   *
   * 返回 `null` 表示点在相机背后。
   */
  projectWorld(x: number, y: number, z: number): { x: number; y: number } | null {
    const camera = this.camera
    if (!camera) return null
    _syncPos.set(x, y, z)
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    const clip = _syncPos.clone().applyMatrix4(camera.matrixWorldInverse)
    if (clip.z > 0) return null // 相机看向 −Z，正的 z 在背后
    _syncPos.project(camera)
    return { x: _syncPos.x, y: _syncPos.y }
  }

  /** 镜头参数：取景是否合理的另一半前提 */
  lensInfo(): { fov: number; aspect: number } | null {
    const camera = this.camera
    if (!camera) return null
    return { fov: camera.fov, aspect: camera.aspect }
  }

  /**
   * 把**房间局部坐标**（`entryPose` 用的那个门坐标系）投到 NDC。
   *
   * 这是验证取景的正确工具。做 Projects 房间时我试过从截图像素反推角度，
   * 两次都得出错误结论（先是"相机被别人转了 30°"，后是"标记不在声明的位置"）
   * ——实际都是反推不可靠。直接问"白板中心落在画面哪里"就没有歧义。
   */
  projectRoom(x: number, y: number, z: number): { x: number; y: number } | null {
    roomLocalToWorld([x, y, z], this.roomRoot, _syncPos)
    return this.projectWorld(_syncPos.x, _syncPos.y, _syncPos.z)
  }

  /** 房间局部 → 世界（调试用，与 `projectRoom` 同一条换算） */
  roomToWorld(x: number, y: number, z: number): [number, number, number] {
    roomLocalToWorld([x, y, z], this.roomRoot, _syncPos)
    return [_syncPos.x, _syncPos.y, _syncPos.z]
  }

  actual(): {
    px: number; py: number; pz: number
    dx: number; dy: number; dz: number
  } | null {
    const camera = this.camera
    if (!camera) return null
    camera.getWorldPosition(_syncPos)
    camera.getWorldDirection(_syncTgt)
    return {
      px: _syncPos.x, py: _syncPos.y, pz: _syncPos.z,
      dx: _syncTgt.x, dy: _syncTgt.y, dz: _syncTgt.z,
    }
  }

  // ── 动作 ──────────────────────────────────────────────────────────────────

  /**
   * 进房：把房间局部的 `entryPose` 换算到世界并移过去。
   *
   * @param roomRoot 挂载后的房间根 group。`null` 时按世界坐标处理
   *                 （只有测试和没有房间容器的场景会这样）
   */
  enterRoom(
    pose: RoomEntryPose,
    roomRoot: THREE.Object3D | null,
    freedom: RoomCameraFreedom | null,
    opts: MoveOptions = {},
  ): void {
    roomLocalToWorld(pose.position, roomRoot, _pos)
    roomLocalToWorld(pose.target, roomRoot, _tgt)

    this.roomPose = {
      px: _pos.x, py: _pos.y, pz: _pos.z,
      tx: _tgt.x, ty: _tgt.y, tz: _tgt.z,
    }
    this.roomFreedom = freedom
    if (roomRoot !== this.roomRoot) {
      this.roomRoot = roomRoot
      // 换了锚点就重新建立基准，否则会把上一个房间的增量作用到这一个上
      this.anchorValid = false
    }

    // 进房即接管：从相机当前位姿（DoorSection 刚把它推进门里）平滑过去，
    // 而不是从 controls 记的旧值
    if (this.suspended) this.resume()

    this.moveToWorld(_pos, _tgt, {
      duration: opts.duration ?? pose.duration,
      ease: opts.ease,
      onArrive: () => {
        this.applyFreedom(freedom)
        opts.onArrive?.()
      },
    })
  }

  /**
   * 对焦一个物体（项目显示器停靠、出版物打开）。
   *
   * 对焦期间强制 scripted：一边看细节一边还能自由 orbit，只会让人转丢。
   * `returnToRoomPose()` 回到进房位姿并恢复自由度。
   */
  frameObject(
    worldTarget: THREE.Vector3,
    worldPosition: THREE.Vector3,
    opts: MoveOptions = {},
  ): void {
    this.applyFreedom(null)
    this.moveToWorld(worldPosition, worldTarget, opts)
  }

  /** 取消对焦 */
  returnToRoomPose(opts: MoveOptions = {}): void {
    const room = this.roomPose
    if (!room) return
    _pos.set(room.px, room.py, room.pz)
    _tgt.set(room.tx, room.ty, room.tz)
    const freedom = this.roomFreedom
    this.moveToWorld(_pos, _tgt, {
      ...opts,
      onArrive: () => {
        this.applyFreedom(freedom)
        opts.onArrive?.()
      },
    })
  }

  /**
   * 世界坐标位姿移动 —— **全类唯一真正写相机的地方**。
   *
   * scripted 模式下每帧把插值结果无过渡地推给 controls（`setLookAt(...,
   * false)`）。这样 controls 的内部球面坐标始终与实际相机一致，动画结束后
   * 切回 free 时不会"跳"回它自己记的旧位置。
   */
  moveToWorld(
    position: THREE.Vector3,
    target: THREE.Vector3,
    { duration = 0.9, ease = 'power2.inOut', onArrive }: MoveOptions = {},
  ): void {
    if (!this.controls) return
    this.tween?.kill()

    const next = {
      px: position.x, py: position.y, pz: position.z,
      tx: target.x, ty: target.y, tz: target.z,
    }

    if (duration <= 0) {
      Object.assign(this.pose, next)
      this.push()
      this.mode = 'idle'
      onArrive?.()
      return
    }

    this.mode = 'scripted'
    // 插值期间禁用输入：不禁的话拖拽会和 tween 抢同一个 pose
    this.controls.enabled = false

    this.tween = gsap.to(this.pose, {
      ...next,
      duration,
      ease,
      onUpdate: () => this.push(),
      onComplete: () => {
        this.tween = null
        this.mode = 'idle'
        onArrive?.()
      },
    })
  }

  // ── 内部 ──────────────────────────────────────────────────────────────────

  /**
   * 让相机跟着房间走。
   *
   * ## 为什么需要
   *
   * `enterRoom` 把房间局部的 `entryPose` 换算成世界坐标——**只换算一次**。
   * 但房间根的世界矩阵在进房之后还会变：门板与门框在开门动画里继续转，
   * 走廊段落也可能被回收重排。矩阵一变，房间内容就整体移动了，而相机留在
   * 原来的世界坐标上——于是取景偏掉。
   *
   * 实机量到的就是这个：`roomToWorld(entryPose)` 给 (6.742, 0.35, 88.217)，
   * 而相机实际在 (7.180, 0.35, 89.612)，差 1.46 个单位；桌心原点本该投在
   * 画面正中（NDC x=0），实测 −1.66。停靠再收回时更明显——重新进房用的是
   * 另一个矩阵，相机被甩到门外的走廊里。
   *
   * ## 做法
   *
   * 每帧算房间根世界矩阵的**增量** `M_now × M_prev⁻¹`，把它作用到 controls
   * 的 position 与 target 上。这样：
   *   - 房间动，相机跟着动，相对取景不变
   *   - 用户的 orbit 输入（世界空间的球面偏移）原样保留——不是每帧硬拉回
   *     entryPose，那会让房间里根本转不动
   *
   * 房间不动时增量是单位矩阵，什么都不做（矩阵比较很便宜）。
   */
  private followAnchor(): void {
    const root = this.roomRoot
    const controls = this.controls
    if (!root || !controls) return

    root.updateWorldMatrix(true, false)

    if (!this.anchorValid) {
      this.anchorMatrix.copy(root.matrixWorld)
      this.anchorValid = true
      return
    }

    if (this.anchorMatrix.equals(root.matrixWorld)) return

    // delta = M_now × M_prev⁻¹
    _deltaMatrix.copy(this.anchorMatrix).invert().premultiply(root.matrixWorld)
    this.anchorMatrix.copy(root.matrixWorld)

    controls.getPosition(_syncPos)
    controls.getTarget(_syncTgt)
    _syncPos.applyMatrix4(_deltaMatrix)
    _syncTgt.applyMatrix4(_deltaMatrix)
    controls.setLookAt(
      _syncPos.x, _syncPos.y, _syncPos.z,
      _syncTgt.x, _syncTgt.y, _syncTgt.z,
      false,
    )
    this.syncPoseFromControls()
  }

  private applyLean(): void {
    const camera = this.camera
    if (!camera) return
    const { pitch, bank } = this.lean
    if (pitch === 0 && bank === 0) return
    // 局部轴的相对旋转，顺序 pitch → bank（先抬头再压侧倾，和身体动作一致）
    camera.rotateX(pitch)
    camera.rotateZ(bank)
  }

  private push(): void {
    const { px, py, pz, tx, ty, tz } = this.pose
    this.controls?.setLookAt(px, py, pz, tx, ty, tz, false)
  }

  /**
   * 相机 → controls。`syncPoseFromControls` 的反向。
   *
   * target 取相机正前方一段距离处：相机本身只有位置与朝向，没有"看向哪个点"
   * 的概念，而 controls 的模型是 position + target。距离用当前的 `distance`，
   * 没有就取一个中庸值，免得 target 落在相机内部导致球面坐标退化。
   */
  private syncControlsFromCamera(): void {
    const controls = this.controls
    const camera = this.camera
    if (!controls || !camera) return

    const distance = controls.distance > 0.1 ? controls.distance : 5
    camera.getWorldPosition(_syncPos)
    camera.getWorldDirection(_syncTgt)
    _syncTgt.multiplyScalar(distance).add(_syncPos)

    controls.setLookAt(
      _syncPos.x, _syncPos.y, _syncPos.z,
      _syncTgt.x, _syncTgt.y, _syncTgt.z,
      false,
    )
    this.syncPoseFromControls()
  }

  private syncPoseFromControls(): void {
    const controls = this.controls
    if (!controls) return
    controls.getPosition(_syncPos)
    controls.getTarget(_syncTgt)
    this.pose.px = _syncPos.x; this.pose.py = _syncPos.y; this.pose.pz = _syncPos.z
    this.pose.tx = _syncTgt.x; this.pose.ty = _syncTgt.y; this.pose.tz = _syncTgt.z
  }

  /**
   * 把 `RoomCameraFreedom` 翻成 camera-controls 的限位。
   *
   * `null` = 完全锁死（`enabled = false`）。给了范围就以**当前朝向**为中心
   * 加限位——`enterRoom` 在 onArrive 里调，此时相机已经在 entryPose 上，
   * 所以"相对 entryPose"这个语义是靠当前值算出来的，而不是再存一份角度。
   */
  private applyFreedom(freedom: RoomCameraFreedom | null): void {
    const controls = this.controls
    if (!controls) return

    this.mode = freedom ? 'free' : 'idle'

    if (!freedom) {
      controls.enabled = false
      return
    }

    const azimuth = controls.azimuthAngle
    const polar = controls.polarAngle
    const distance = controls.distance

    controls.minAzimuthAngle = azimuth + freedom.azimuth[0]
    controls.maxAzimuthAngle = azimuth + freedom.azimuth[1]
    // polar 必须留在 (0, π) 开区间内：0 或 π 是球面坐标的极点，
    // 到点上 up 向量退化，画面会绕着看向轴自转
    controls.minPolarAngle = clampPolar(polar + freedom.polar[0])
    controls.maxPolarAngle = clampPolar(polar + freedom.polar[1])
    controls.minDistance = Math.max(0.01, freedom.distance[0])
    controls.maxDistance = Math.max(controls.minDistance + 0.01, freedom.distance[1])
    // 限位可能把当前距离挤到范围外，夹一次免得第一帧猛地拉近
    controls.distance = Math.min(
      controls.maxDistance,
      Math.max(controls.minDistance, distance),
    )
    controls.enabled = true
  }
}

const POLAR_EPSILON = 0.02

export function clampPolar(angle: number): number {
  return Math.min(Math.PI - POLAR_EPSILON, Math.max(POLAR_EPSILON, angle))
}

/** 全站单例。相机只有一个，所有者也只该有一个 */
export const cameraDirector = new CameraDirector()

/**
 * 调试出口。
 *
 * 相机取景错了**不会报任何错**，只是"看起来不对"——审计 A4 就在 main 上活了
 * 很久。而生产构建里拿不到 R3F 的内部 state，所以从外面没法验证相机到底在
 * 哪。挂一个只读快照出口，让 E2E 能断言「相机在房间内」「距离在声明范围内」
 * 这类几何事实，而不是靠人看截图。
 *
 * 只暴露读，不暴露任何能移动相机的方法：这是观察窗，不是遥控器。
 */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__labCamera = {
    snapshot: () => cameraDirector.snapshot(),
    actual: () => cameraDirector.actual(),
    project: (x: number, y: number, z: number) => cameraDirector.projectWorld(x, y, z),
    projectRoom: (x: number, y: number, z: number) => cameraDirector.projectRoom(x, y, z),
    roomToWorld: (x: number, y: number, z: number) => cameraDirector.roomToWorld(x, y, z),
    fov: () => cameraDirector.lensInfo(),
    mode: () => cameraDirector.currentMode,
    suspended: () => cameraDirector.isSuspended,
  }
}
