import type React from 'react'
import * as THREE from 'three'
import { extend } from '@react-three/fiber'

// Brush-stroke reveal shader extending MeshBasicMaterial.
// Used for balloons and award cards (no lighting needed).
// Direct port of itomdev RevealBasicMaterial.jsx.
class RevealBasicMaterial extends THREE.MeshBasicMaterial {
  private _uProgress = 0.0
  private _shader: THREE.WebGLProgramParametersWithUniforms | null = null

  get uProgress() { return this._uProgress }
  set uProgress(v: number) {
    this._uProgress = v
    if (this._shader) this._shader.uniforms.uProgress.value = v
  }

  customProgramCacheKey() { return 'RevealBasicMaterial_v1' }

  onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
    this._shader = shader
    shader.uniforms.uProgress = { value: this._uProgress }

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */`#include <common>
      uniform float uProgress;

      float revealRand(vec2 n) {
        return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
      }
      float revealNoise(vec2 p) {
        vec2 ip = floor(p);
        vec2 u  = fract(p);
        u = u * u * (3.0 - 2.0 * u);
        float res = mix(
          mix(revealRand(ip), revealRand(ip + vec2(1.0, 0.0)), u.x),
          mix(revealRand(ip + vec2(0.0, 1.0)), revealRand(ip + vec2(1.0, 1.0)), u.x),
          u.y);
        return res * res;
      }
      `
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      /* glsl */`#include <alphatest_fragment>
      if (uProgress > 0.001) {
        float rn = revealNoise(vMapUv * 15.0) * 0.15;
        float maskValue = (1.0 - vMapUv.y) + rn;
        if (maskValue < uProgress * 1.5) discard;
      }
      `
    )
  }
}

extend({ RevealBasicMaterial })
export { RevealBasicMaterial }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      revealBasicMaterial: {
        ref?: React.Ref<{ uProgress: number; opacity: number } | null>
        map?: THREE.Texture | null
        transparent?: boolean
        alphaTest?: number
        depthWrite?: boolean
        uProgress?: number
        opacity?: number
        side?: THREE.Side
        color?: string
      }
    }
  }
}
