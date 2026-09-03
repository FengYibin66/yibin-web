'use client'

import { ProjectsRoom } from './ProjectsRoom'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

/**
 * Projects 房间的入口。
 *
 * 「深夜实验室」（ADR 20260903140619）已落地在同目录的 `ProjectsRoom.tsx`：
 * 走廊纹理复用的封闭房间 + 后墙自绘架构白板 + 右墙机柜 + 左墙刻度盘 +
 * 中央环形工作台上的 8 块显示器，交互是转盘吸附 + 停靠。
 *
 * 旧的 `components/rooms/ProjectsRoom.tsx`（无限下落的显示器塔、无环境、
 * 相机在错误坐标系里取景）已删除。
 *
 * 保留这一层适配是因为注册表的 `view` 路径不该随内部结构变——它把
 * `RoomViewProps` 的 `phase` 翻成组件的 `isExiting`。
 */
export function ProjectsRoomView({ phase }: RoomViewProps) {
  return <ProjectsRoom showRoom isExiting={phase === 'exiting'} />
}

export default ProjectsRoomView
