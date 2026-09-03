'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { recordAchievement } from '@/lib/lab/achievementStorage'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

/**
 * Gallery 的「房间视图」—— 它不渲染任何 3D 内容，只负责跳转到 `/gallery`。
 *
 * 存在的意义是让 Gallery 不再是编排代码里的特例。原先
 * `DoorSection` / `RoomInterior` / `TeleportRoom` / `roomAssets` 里各有一处
 * `if (roomId === 'gallery')`，而正是那些特例分支把 3D 版画廊
 * （`components/rooms/GalleryRoom.tsx`）绕成了零渲染方的死代码——
 * `gallery_inspect` 成就的唯一解锁调用就在那个文件里，于是"Art Critic"永远
 * 解不开，且没有任何东西能发现（审计 D1）。
 *
 * 现在它是一个正常的 view：门照常对齐、动画照常播，`entryPose.duration = 0`
 * 表示不进房，挂载即跳转。`corridor_enter` 在这里记——用户确实"进了一扇门"。
 */
export function GalleryDoorView({ phase }: RoomViewProps) {
  const router = useRouter()

  useEffect(() => {
    if (phase === 'exiting') return
    recordAchievement('corridor_enter')
    router.push('/gallery?from=lab')
  }, [phase, router])

  return null
}

export default GalleryDoorView
