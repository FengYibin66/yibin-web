'use client'

import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'

import { cameraDirector } from '@/lib/lab/app/camera/CameraDirector'

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
  useFrame((_, delta) => cameraDirector.update(delta), -1)

  return null
}
