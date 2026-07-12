import { act, renderHook } from '@testing-library/react'
import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePaintMaterial } from '@/components/rooms/publications/usePaintMaterial'

interface TweenVars {
  value: number
  onComplete: () => void
  onInterrupt: () => void
}

const mocks = vi.hoisted(() => ({
  tweens: [] as Array<{
    vars: TweenVars
    kill: ReturnType<typeof vi.fn>
  }>,
  to: vi.fn(),
}))

vi.mock('gsap', () => ({
  default: {
    to: mocks.to,
  },
}))

beforeEach(() => {
  mocks.tweens.length = 0
  mocks.to.mockReset()
  mocks.to.mockImplementation((_: object, vars: TweenVars) => {
    const tween = { vars, kill: vi.fn() }
    mocks.tweens.push(tween)
    return tween
  })
})

describe('usePaintMaterial', () => {
  it('keeps the material compile API stable across rerenders', () => {
    const { result, rerender } = renderHook(() => usePaintMaterial())
    const firstPaint = result.current.paint

    rerender()

    expect(result.current.paint).toBe(firstPaint)
  })

  it('reports revealing until the paint tween completes', async () => {
    const { result } = renderHook(() => usePaintMaterial())
    let revealPromise: Promise<void>

    act(() => {
      revealPromise = result.current.reveal()
    })
    expect(result.current.isRevealing).toBe(true)

    act(() => {
      mocks.tweens[0].vars.onComplete()
    })
    await revealPromise!

    expect(result.current.isRevealing).toBe(false)
  })

  it('kills and settles an active reveal when completed immediately', async () => {
    const { result } = renderHook(() => usePaintMaterial())
    let revealPromise: Promise<void>

    act(() => {
      revealPromise = result.current.reveal()
    })
    act(() => {
      result.current.complete()
    })
    await revealPromise!

    expect(mocks.tweens[0].kill).toHaveBeenCalledOnce()
    expect(result.current.isRevealing).toBe(false)
  })

  it('keeps the shader reveal relative to the room world origin', () => {
    const { result } = renderHook(() => usePaintMaterial())
    const shader: {
      uniforms: Record<string, unknown>
      vertexShader: string
      fragmentShader: string
    } = {
      uniforms: {},
      vertexShader: '#include <worldpos_vertex>',
      fragmentShader: '#include <common>\n#include <dithering_fragment>',
    }
    result.current.paint.onBeforeCompile?.(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    )
    const room = new THREE.Group()
    room.position.set(120, 3, -40)
    room.updateMatrixWorld(true)

    result.current.setRoomOrigin(room)

    const origin = shader.uniforms.uRoomOrigin as {
      value: THREE.Vector3
    }
    expect(origin.value.toArray()).toEqual([120, 3, -40])
  })
})
