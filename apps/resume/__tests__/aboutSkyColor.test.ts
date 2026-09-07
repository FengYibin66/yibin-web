import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { aboutRoom } from '@/lib/lab/domain/rooms/about'
import { CORRIDOR_FOG } from '@/components/lab/SceneFog'

/**
 * About 房间的天空是**米白**，与走廊同色（2026-09-07 用户拍板）。
 *
 * PR #11 把天空平面与房间雾改成浅蓝 `#d4e8f5`，用户看到后问「怎么全变蓝了，
 * 是 bug 吗」——不是 bug，是没人问过他就改了配色。改回米色是两个字面量，
 * 但它们分别在 domain 声明（雾）与组件（天空平面）里，第三处是走廊的
 * `CORRIDOR_FOG`。三处不同色的后果是远端云层处露一圈色差，而且没有报错。
 * 所以这里把三处钉在一起：改任一处，另两处必须跟。
 */
const ROOT = join(import.meta.dirname, '..')

describe('About 天空配色', () => {
  it('房间雾色与走廊底色同一米白', () => {
    expect(aboutRoom.fog, 'About 声明了自己的雾').not.toBeNull()
    expect(aboutRoom.fog!.color.toLowerCase()).toBe(CORRIDOR_FOG.color.toLowerCase())
  })

  it('天空平面的颜色与雾色相同 —— 两处不同色会在远端露一圈色差', () => {
    const src = readFileSync(join(ROOT, 'components/rooms/AboutRoom.tsx'), 'utf8')
    /*
      天空平面是 `<planeGeometry args={[1600, 800]}>` 后面那个 `meshBasicMaterial`。
      按结构取而不是按颜色搜：按颜色搜的话把两处一起改错也是绿的。
    */
    const match = src.match(/planeGeometry args=\{\[1600, 800\]\} \/>\s*<meshBasicMaterial color="(#[0-9a-fA-F]{6})"/)
    expect(match, '没找到天空平面的 meshBasicMaterial，结构变了就同步这条正则').not.toBeNull()
    expect(match![1]!.toLowerCase()).toBe(aboutRoom.fog!.color.toLowerCase())
  })

  it('不再是 PR #11 的浅蓝', () => {
    expect(aboutRoom.fog!.color.toLowerCase()).not.toBe('#d4e8f5')
  })
})
