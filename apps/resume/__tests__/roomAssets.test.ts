import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTexture } from '@react-three/drei'
import {
  PUBLICATION_AUDIO_ASSETS,
  ROOM_ASSETS,
  preloadRoomAssets,
  reloadRoomAssets,
} from '@/lib/lab/roomAssets'

vi.mock('@react-three/drei', () => ({
  useTexture: {
    clear: vi.fn(),
    preload: vi.fn(),
  },
}))

const ROOM_IDS = ['about', 'projects', 'publications', 'contact'] as const
const PUBLICATION_TEXTURES = [
  '/textures/gallery/floor.webp',
  '/textures/gallery/railing.webp',
  '/textures/corridor/texturadoprogow.webp',
  '/textures/gallery/domki.webp',
  '/textures/gallery/miastotlo.webp',
  '/textures/gallery/bird_gray.webp',
  '/textures/gallery/klamerka.webp',
  '/textures/gallery/tylkartki.webp',
  '/textures/gallery/tylkartki_painted.webp',
  '/textures/gallery/przyciskdotylukartki.webp',
  '/textures/gallery/przyciskdotylukartki_painted.webp',
  '/textures/gallery/monetuneprzod.webp',
  '/textures/gallery/monetuneprzod_painted.webp',
  '/textures/gallery/timberkittyprzod.webp',
  '/textures/gallery/timberkittyprzod_painted.webp',
  '/textures/gallery/youngmultiprzod.webp',
  '/textures/gallery/youngmultiprzod_painted.webp',
  '/textures/gallery/bioprzod.webp',
  '/textures/gallery/bioprzod_painted.webp',
] as const

describe('ROOM_ASSETS', () => {
  it('仅包含四个普通房间', () => {
    expect(Object.keys(ROOM_ASSETS).sort()).toEqual([...ROOM_IDS].sort())
    expect(ROOM_ASSETS).not.toHaveProperty('gallery')
  })

  it.each(ROOM_IDS)('%s 有非空且房间内无重复的纹理清单', (roomId) => {
    const assets = ROOM_ASSETS[roomId]

    expect(assets.length).toBeGreaterThan(0)
    expect(new Set(assets).size).toBe(assets.length)
  })

  it.each(ROOM_IDS)('%s 仅收录供 useTexture 预载的纹理 URL', (roomId) => {
    for (const asset of ROOM_ASSETS[roomId]) {
      expect(asset).toMatch(/^\/textures\//)
    }
  })

  it('允许独立房间共享实际依赖的纹理', () => {
    const aboutAssets = new Set(ROOM_ASSETS.about)
    const sharedAssets = ROOM_ASSETS.publications.filter(asset => aboutAssets.has(asset))

    expect(sharedAssets.length).toBeGreaterThan(0)
  })

  it('publications 收录完整场景和纸张纹理变体', () => {
    expect(ROOM_ASSETS.publications).toEqual(
      expect.arrayContaining([...PUBLICATION_TEXTURES]),
    )
  })

  it('将纸张与城市音频独立于纹理清单', () => {
    expect(PUBLICATION_AUDIO_ASSETS).toEqual([
      '/sounds/papersound.mp3',
      '/sounds/szummiasta.mp3',
    ])
    expect(ROOM_ASSETS.publications).not.toEqual(
      expect.arrayContaining([...PUBLICATION_AUDIO_ASSETS]),
    )
  })
})

describe('preloadRoomAssets', () => {
  beforeEach(() => {
    vi.mocked(useTexture.clear).mockClear()
    vi.mocked(useTexture.preload).mockClear()
  })

  it('逐个预载房间清单且同一房间只执行一次', () => {
    preloadRoomAssets('about')
    preloadRoomAssets('about')

    expect(useTexture.preload).toHaveBeenCalledTimes(ROOM_ASSETS.about.length)
    ROOM_ASSETS.about.forEach((asset, index) => {
      expect(useTexture.preload).toHaveBeenNthCalledWith(index + 1, asset)
    })
  })

  it('清除每个缓存 URL 后重置幂等状态并重新预载', () => {
    preloadRoomAssets('projects')
    vi.mocked(useTexture.preload).mockClear()

    reloadRoomAssets('projects')
    preloadRoomAssets('projects')

    expect(useTexture.clear).toHaveBeenCalledTimes(ROOM_ASSETS.projects.length)
    expect(useTexture.preload).toHaveBeenCalledTimes(ROOM_ASSETS.projects.length)
    ROOM_ASSETS.projects.forEach((asset, index) => {
      expect(useTexture.clear).toHaveBeenNthCalledWith(index + 1, asset)
      expect(useTexture.preload).toHaveBeenNthCalledWith(index + 1, asset)
      expect(
        vi.mocked(useTexture.clear).mock.invocationCallOrder[index],
      ).toBeLessThan(
        vi.mocked(useTexture.preload).mock.invocationCallOrder[index],
      )
    })
  })

  it('不通过 useTexture 预载 publications 音频', () => {
    reloadRoomAssets('publications')

    for (const audioAsset of PUBLICATION_AUDIO_ASSETS) {
      expect(useTexture.preload).not.toHaveBeenCalledWith(audioAsset)
    }
  })
})
