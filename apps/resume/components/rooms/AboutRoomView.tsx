'use client'

import { AboutRoom } from './AboutRoom'
import type { RoomViewProps } from '@/lib/lab/domain/rooms/types'

/**
 * `RoomDefinition.view` 的适配层。
 *
 * 房间注册表用统一的 `phase` 描述生命周期（ADR 20260903140615），而既有房间
 * 组件收的是 `showRoom` / `isExiting` 两个布尔——那两个布尔的四种组合里只有
 * 三种有意义，第四种（`showRoom=false, isExiting=true`）从来没有定义过。
 * 这层把 phase 映射过去；等房间组件本身改签名后即可删除。
 */
export function AboutRoomView({ phase }: RoomViewProps) {
  return <AboutRoom showRoom isExiting={phase === 'exiting'} />
}

export default AboutRoomView
