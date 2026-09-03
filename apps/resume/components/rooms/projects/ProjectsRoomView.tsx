'use client'

import { ProjectsRoom } from '../ProjectsRoom'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

/**
 * Projects 房间的入口。
 *
 * 现在只是既有 `ProjectsRoom`（一座无限下落的显示器塔，无环境）的适配层。
 * ADR 20260903140619 会把它替换成「深夜实验室」：走廊纹理复用的封闭房间 +
 * 后墙自绘架构白板 + 右墙机柜 + 左墙夜窗 + 中央圆形工作台的 8 块显示器，
 * 交互从"无限下落"改为转盘吸附 + 停靠规格页。
 *
 * 放成独立文件而不是直接指向 `../ProjectsRoom`，是为了让那次替换只动这一个
 * 目录，注册表的 `view` 路径不变。
 */
export function ProjectsRoomView({ phase }: RoomViewProps) {
  return <ProjectsRoom showRoom isExiting={phase === 'exiting'} />
}

export default ProjectsRoomView
