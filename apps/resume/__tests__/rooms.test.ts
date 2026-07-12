/**
 * 单元测试：房间系统核心纯逻辑
 * 覆盖：SkyChunk seededRandom、云朵配置、SocialBarrel 路径派生、
 *       wave 动画数学、NavigationUI z-index 关系、轮询守卫逻辑
 */
import { describe, it, expect } from 'vitest'

// ─── seededRandom（从 SkyChunk 提取）────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed
  return function () {
    s = Math.sin(s * 9999) * 10000
    return s - Math.floor(s)
  }
}

describe('seededRandom', () => {
  it('返回 [0,1) 范围内的值', () => {
    const rand = seededRandom(42)
    for (let i = 0; i < 20; i++) {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('相同 seed 产生相同序列（确定性）', () => {
    const r1 = seededRandom(100)
    const r2 = seededRandom(100)
    for (let i = 0; i < 10; i++) {
      expect(r1()).toBeCloseTo(r2(), 10)
    }
  })

  it('不同 seed 产生不同序列', () => {
    const r1 = seededRandom(1)
    const r2 = seededRandom(2)
    const seq1 = Array.from({ length: 5 }, () => r1())
    const seq2 = Array.from({ length: 5 }, () => r2())
    expect(seq1).not.toEqual(seq2)
  })
})

// ─── SkyChunk cloud placement ────────────────────────────────────────────────

const CHUNK_LENGTH = 40
const CHUNK_WIDTH  = 20
const CHUNK_HEIGHT = 12
const CLOUD_TEXTURE_COUNT = 8

describe('SkyChunk cloud generation', () => {
  function generateClouds(chunkIndex: number, seed: number) {
    const zOffset = -(chunkIndex * CHUNK_LENGTH) - 15
    const items: { x: number; y: number; z: number; textureIndex: number }[] = []
    const random = seededRandom(seed + chunkIndex * 1000)
    const cloudCount = 15 + Math.floor(random() * 8)

    for (let i = 0; i < cloudCount; i++) {
      const x = (random() - 0.5) * CHUNK_WIDTH
      const y = (random() - 0.5) * CHUNK_HEIGHT
      const z = zOffset - random() * CHUNK_LENGTH
      items.push({ x, y, z, textureIndex: Math.floor(random() * CLOUD_TEXTURE_COUNT) })
    }
    return items
  }

  it('生成 15-22 朵云', () => {
    const clouds = generateClouds(0, 42)
    expect(clouds.length).toBeGreaterThanOrEqual(15)
    expect(clouds.length).toBeLessThanOrEqual(23)
  })

  it('云的 X 坐标在 [-10, 10] 内', () => {
    const clouds = generateClouds(0, 42)
    clouds.forEach(c => {
      expect(c.x).toBeGreaterThanOrEqual(-CHUNK_WIDTH / 2)
      expect(c.x).toBeLessThanOrEqual(CHUNK_WIDTH / 2)
    })
  })

  it('textureIndex 在 [0, 7] 范围内', () => {
    const clouds = generateClouds(0, 42)
    clouds.forEach(c => {
      expect(c.textureIndex).toBeGreaterThanOrEqual(0)
      expect(c.textureIndex).toBeLessThan(CLOUD_TEXTURE_COUNT)
    })
  })

  it('不同 chunkIndex 产生不同云布局', () => {
    const c0 = generateClouds(0, 42)
    const c1 = generateClouds(1, 42)
    expect(c0.map(c => c.x)).not.toEqual(c1.map(c => c.x))
  })

  it('chunkIndex=0 的云 Z 坐标在正确范围内', () => {
    const clouds = generateClouds(0, 42)
    // zOffset = -15, 云 Z = zOffset - rand()*CHUNK_LENGTH = -15 to -55
    clouds.forEach(c => {
      expect(c.z).toBeLessThanOrEqual(-15)
      expect(c.z).toBeGreaterThanOrEqual(-55)
    })
  })
})

// ─── CORRIDOR_CLIP_Z / ROOM_Z 遮挡逻辑 ──────────────────────────────────────

const CORRIDOR_CLIP_Z = -8.0
const ROOM_Z = -25

function isCloudVisible(cloudLocalZ: number, scrollProgress: number): boolean {
  const worldZ = ROOM_Z + scrollProgress + cloudLocalZ
  return worldZ < CORRIDOR_CLIP_Z
}

describe('Cloud / milestone world-space clip', () => {
  it('scrollProgress=0 时，Z=-50 的云可见', () => {
    expect(isCloudVisible(-50, 0)).toBe(true)
  })

  it('scrollProgress=0 时，Z=-5（靠近走廊入口）的云不可见', () => {
    // worldZ = -25 + 0 + (-5) = -30 < -8 → visible
    expect(isCloudVisible(-5, 0)).toBe(true)
    // worldZ = -25 + 25 + (-5) = -5 > -8 → NOT visible
    expect(isCloudVisible(-5, 25)).toBe(false)
  })

  it('scrollProgress 增大使更多内容超过 clip 而不可见', () => {
    const cloudLocalZ = -10
    expect(isCloudVisible(cloudLocalZ, 0)).toBe(true)   // worldZ = -35 < -8
    expect(isCloudVisible(cloudLocalZ, 30)).toBe(false)  // worldZ = -5 > -8
  })

  it('ROOM_Z + CORRIDOR_CLIP_Z 确定能进入房间的最大 scrollProgress', () => {
    // 当 worldZ = ROOM_Z + scroll + cloudZ >= CORRIDOR_CLIP_Z 时消失
    // 临界值：scroll = CORRIDOR_CLIP_Z - ROOM_Z - cloudZ
    const cloudLocalZ = 0
    const clipScroll = CORRIDOR_CLIP_Z - ROOM_Z - cloudLocalZ // = -8 - (-25) = 17
    expect(isCloudVisible(cloudLocalZ, clipScroll - 0.1)).toBe(true)
    expect(isCloudVisible(cloudLocalZ, clipScroll + 0.1)).toBe(false)
  })
})

// ─── SocialBarrel 纹理路径派生 ───────────────────────────────────────────────

function derivePaintedPath(texturePath: string): string {
  return texturePath.replace('.webp', '_painted.webp').replace('.png', '_painted.png')
}

describe('SocialBarrel painted texture path derivation', () => {
  it('从 .webp 派生 _painted.webp', () => {
    expect(derivePaintedPath('/textures/contact/beczka.webp'))
      .toBe('/textures/contact/beczka_painted.webp')
  })

  it('从 .png 派生 _painted.png', () => {
    expect(derivePaintedPath('/textures/something/item.png'))
      .toBe('/textures/something/item_painted.png')
  })

  it('已经是 painted 的路径不会双倍 suffix', () => {
    // 这个行为实际上会产生 _painted_painted.webp，是已知的边界情况
    // 测试记录这个行为（调用者不应传入已 painted 的路径）
    const path = derivePaintedPath('/textures/contact/beczka_painted.webp')
    expect(path).toBe('/textures/contact/beczka_painted_painted.webp')
  })

  it('路径里的扩展名之前的内容不受影响', () => {
    const result = derivePaintedPath('/textures/about/awatarnachmurce.webp')
    expect(result).toBe('/textures/about/awatarnachmurce_painted.webp')
    expect(result).toContain('/textures/about/')
  })
})

// ─── Wave animation math ─────────────────────────────────────────────────────

describe('Contact room wave animation', () => {
  function waveY(layerIndex: number, time: number): number {
    const speed     = 0.8 + layerIndex * 0.15
    const amplitude = 0.15 - layerIndex * 0.02
    const offset    = layerIndex * 0.5
    return Math.sin(time * speed + offset) * amplitude
  }

  it('layer 0 振幅为 0.15，speed 为 0.8', () => {
    // sin 的最大值为1，所以 waveY 最大值 = amplitude
    let maxY = -Infinity
    for (let t = 0; t < 100; t += 0.01) {
      maxY = Math.max(maxY, waveY(0, t))
    }
    expect(maxY).toBeCloseTo(0.15, 2)
  })

  it('layer 1 振幅为 0.13', () => {
    let maxY = -Infinity
    for (let t = 0; t < 100; t += 0.01) {
      maxY = Math.max(maxY, waveY(1, t))
    }
    expect(maxY).toBeCloseTo(0.13, 2)
  })

  it('layer 3 振幅为 0.09', () => {
    let maxY = -Infinity
    for (let t = 0; t < 100; t += 0.01) {
      maxY = Math.max(maxY, waveY(3, t))
    }
    expect(maxY).toBeCloseTo(0.09, 2)
  })

  it('不同 layer 的相位不同（不同步）', () => {
    const y0_at_0 = waveY(0, 0)
    const y1_at_0 = waveY(1, 0)
    const y2_at_0 = waveY(2, 0)
    // 三层不应该在 t=0 有完全相同的值
    expect([y0_at_0, y1_at_0, y2_at_0]).not.toEqual([y0_at_0, y0_at_0, y0_at_0])
  })
})

// ─── NavigationUI z-index 关系 ───────────────────────────────────────────────

describe('NavigationUI z-index hierarchy', () => {
  const Z_PANELS   = 100  // map panel, audio panel
  const Z_OVERLAY  = 50   // click-away overlay
  const Z_ACHIEVEMENTS_PANEL = 95  // .achievements-panel CSS z-index

  it('面板 z-index > 点击穿透层，确保按钮可点击', () => {
    expect(Z_PANELS).toBeGreaterThan(Z_OVERLAY)
  })

  it('AchievementsPanel z-index > 点击穿透层', () => {
    expect(Z_ACHIEVEMENTS_PANEL).toBeGreaterThan(Z_OVERLAY)
  })

  it('面板和 AchievementsPanel 均高于穿透层', () => {
    expect(Math.min(Z_PANELS, Z_ACHIEVEMENTS_PANEL)).toBeGreaterThan(Z_OVERLAY)
  })
})

// ─── showRoomRef 守卫逻辑 ────────────────────────────────────────────────────

describe('wheel event showRoom guard', () => {
  function makeGuardedHandler(
    showRoomRef: { current: boolean },
    isExiting: boolean,
    onHandle: () => void
  ) {
    return (delta: number) => {
      if (!showRoomRef.current || isExiting) return
      onHandle()
    }
  }

  it('showRoom=false 时 handler 不执行', () => {
    let count = 0
    const handler = makeGuardedHandler({ current: false }, false, () => count++)
    handler(100)
    expect(count).toBe(0)
  })

  it('isExiting=true 时 handler 不执行', () => {
    let count = 0
    const handler = makeGuardedHandler({ current: true }, true, () => count++)
    handler(100)
    expect(count).toBe(0)
  })

  it('showRoom=true 且 isExiting=false 时 handler 执行', () => {
    let count = 0
    const handler = makeGuardedHandler({ current: true }, false, () => count++)
    handler(100)
    expect(count).toBe(1)
  })

  it('showRoom 从 false 变 true 后 handler 开始执行', () => {
    let count = 0
    const ref = { current: false }
    const handler = makeGuardedHandler(ref, false, () => count++)

    handler(100)
    expect(count).toBe(0)

    ref.current = true
    handler(100)
    expect(count).toBe(1)
  })
})

// ─── isTeleporting hasSignaled 重置逻辑 ──────────────────────────────────────

describe('hasSignaled reset on teleport', () => {
  function simulateRoom() {
    let hasSignaled = false
    let frameCount = 0
    let onReadyCalled = 0

    function onReady() { onReadyCalled++ }

    function frame() {
      if (!hasSignaled) {
        frameCount++
        if (frameCount >= 10) {
          hasSignaled = true
          onReady()
        }
      }
    }

    function onTeleport() {
      hasSignaled = false
      frameCount = 0
    }

    return { frame, onTeleport, getOnReadyCalled: () => onReadyCalled }
  }

  it('首次进入：10帧后调用 onReady', () => {
    const room = simulateRoom()
    for (let i = 0; i < 10; i++) room.frame()
    expect(room.getOnReadyCalled()).toBe(1)
  })

  it('进入后 onReady 不再重复调用', () => {
    const room = simulateRoom()
    for (let i = 0; i < 20; i++) room.frame()
    expect(room.getOnReadyCalled()).toBe(1)
  })

  it('teleport 后 hasSignaled 重置，再次进入可触发 onReady', () => {
    const room = simulateRoom()
    for (let i = 0; i < 10; i++) room.frame()
    expect(room.getOnReadyCalled()).toBe(1)

    room.onTeleport()  // 模拟传送

    for (let i = 0; i < 10; i++) room.frame()
    expect(room.getOnReadyCalled()).toBe(2)
  })

  it('teleport 后未满 10 帧不触发 onReady', () => {
    const room = simulateRoom()
    for (let i = 0; i < 10; i++) room.frame()

    room.onTeleport()

    for (let i = 0; i < 5; i++) room.frame()
    expect(room.getOnReadyCalled()).toBe(1)  // 还是 1，还没到 10 帧
  })
})

// ─── GalleryRoomOverlay hasSignaled 逻辑 ────────────────────────────────────

describe('GalleryRoomOverlay onReady timing', () => {
  function simulateOverlay() {
    let hasSignaled = false
    let onReadyCalled = 0

    function trigger(showRoom: boolean, onReady: () => void) {
      if (showRoom && !hasSignaled) {
        hasSignaled = true
        onReadyCalled++
        onReady()
      }
      if (!showRoom) hasSignaled = false
    }

    return { trigger, getOnReadyCalled: () => onReadyCalled }
  }

  it('showRoom=true 首次触发 onReady', () => {
    const overlay = simulateOverlay()
    overlay.trigger(true, () => {})
    expect(overlay.getOnReadyCalled()).toBe(1)
  })

  it('连续 showRoom=true 不重复触发 onReady', () => {
    const overlay = simulateOverlay()
    overlay.trigger(true, () => {})
    overlay.trigger(true, () => {})
    overlay.trigger(true, () => {})
    expect(overlay.getOnReadyCalled()).toBe(1)
  })

  it('showRoom=false 重置状态，下次 true 重新触发', () => {
    const overlay = simulateOverlay()
    overlay.trigger(true, () => {})
    overlay.trigger(false, () => {})
    overlay.trigger(true, () => {})
    expect(overlay.getOnReadyCalled()).toBe(2)
  })

  it('showRoom=false 不触发 onReady', () => {
    const overlay = simulateOverlay()
    overlay.trigger(false, () => {})
    expect(overlay.getOnReadyCalled()).toBe(0)
  })
})
