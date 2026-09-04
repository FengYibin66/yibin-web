'use client'

import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'

import { cameraDirector } from '@/lib/lab/app/camera/CameraDirector'
import { labAssertsEnabled } from '@/lib/lab/app/labAsserts'

/**
 * 把 `CameraDirector` 接进 R3F 的渲染循环。
 *
 * **全站唯一一处 `controls.update()`**。刻意做成一个空渲染组件而不是 hook：
 * hook 可以被多个组件各调一次（那就是多个 update 循环、彼此覆盖），而组件
 * 挂在 `LabScene` 里只有一个实例，多挂一个会立刻在 React 树上看出来。
 *
 * 见 ADR 20260903140617。
 */
export function CameraRig() {
  const camera = useThree(s => s.camera)
  const gl = useThree(s => s.gl)

  useEffect(() => {
    if (!(camera as THREE.Camera & { isPerspectiveCamera?: boolean }).isPerspectiveCamera) return
    cameraDirector.attach(camera as THREE.PerspectiveCamera, gl.domElement)
    return () => cameraDirector.detach()
  }, [camera, gl])

  /*
    优先级 −1：R3F 按 priority **升序**执行 useFrame 回调，所以这一条排在
    默认的 0 之前——相机先更新完，同一帧里读 `camera.position` 的那些
    （Avatar 朝向、HeroText 视差、环境音 listener）读到的就是本帧的新值，
    而不是上一帧的。

    不能用正数：R3F 在 `renderPriority > 0` 时会关掉自动渲染，要求调用侧
    自己 `gl.render()`。负数与 0 都保持自动渲染。
  */
  useFrame((_, delta) => {
    /*
      开发态：先查上一帧写完之后，相机有没有被**别人**动过。

      顺序很关键——必须在本帧 `update()` 之前查，因为 `update()` 会把相机重写成
      导演想要的位姿，把证据抹掉。

      这条断言是「所有权是显式状态」这件事的兑现方式（ADR 20260903211244）。
      写点棘轮（`__tests__/cameraOwnership.test.ts`）守的是"谁写了相机"这个**静态**
      事实，而它守不住"在错误的时刻写"：进房时导演与 `DoorSection` 的 gsap 重叠约
      2 秒，两边都在棘轮里登记过，静态扫描完全看不出问题。那次靠的是人读源码
      加算 rAF 注册顺序才发现——而表现是"动画被静默吞掉、画面看起来正常"。

      有了这条，同一类问题在**第一次实机运行**时就抛。
    */
    /*
      不是 `NODE_ENV !== 'production'`：本应用静态导出，E2E 打的是生产构建，
      那个条件让这条断言在全部 E2E 里一次都没跑过（首帧假阳性就是这么漏到实机的）。
      E2E 通过 `localStorage.lab_asserts` 把它打开——见 `labAsserts.ts`。
    */
    if (labAssertsEnabled()) {
      const drift = cameraDirector.ownershipDrift()
      if (drift !== null && drift > OWNERSHIP_DRIFT_EPSILON) {
        throw new Error(
          `相机在导演持有期间被别人写过（偏差 ${drift.toExponential(2)}）。`
          + '同一帧里有第二个写者——查 gsap tween、useFrame 回调，'
          + '或提前接管的房间。见 ADR 20260903211244',
        )
      }
    }

    cameraDirector.update(delta)
  }, -1)

  return null
}

/**
 * 判定"相机被别人动过"的阈值（位置平方距离 + 四元数平方距离之和）。
 *
 * 不能用 0：`camera-controls` 的阻尼与 gsap 的插值都会带来最后一位的浮点差，
 * 而 `recordWritten` 记的是本帧写完的值、下一帧开头再比——中间隔着一次渲染。
 * 1e-8 对应约 1e-4 个世界单位的位置偏差（相机在房间里的量级是 1–10 单位），
 * 而真实的双写偏差是 0.1 以上——两者差六个数量级，不会误判。
 */
const OWNERSHIP_DRIFT_EPSILON = 1e-8
