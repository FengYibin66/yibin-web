import type React from 'react'
import * as THREE from 'three'
import { extend } from '@react-three/fiber'

// Brush-stroke reveal shader — extends MeshBasicMaterial.
// Set uProgress 0→1 to progressively discard sketch pixels from bottom-to-top
// with noisy edges, revealing a painted layer placed behind.
// Direct port of itomdev RevealMaterial.jsx.
class RevealMaterial extends THREE.MeshBasicMaterial {
  private _uProgress = 0.0
  /**
   * 「画出来了没有」（规格 lab-corridor-story.md §1）：0 = 一笔没画，1 = 线稿完整。
   * 与 `uProgress`（草稿 → 上色）独立：加载期由 `loadIntroInk` 驱动这个，加载完恒 1；
   * `uProgress` 由记忆 / 圈数 / 悬停决定。默认 1，不接线的使用方看不出区别。
   */
  private _uDraw = 1.0
  private _shader: THREE.WebGLProgramParametersWithUniforms | null = null

  get uProgress() { return this._uProgress }
  set uProgress(v: number) {
    this._uProgress = v
    if (this._shader) this._shader.uniforms.uProgress.value = v
  }

  get uDraw() { return this._uDraw }
  set uDraw(v: number) {
    this._uDraw = v
    if (this._shader) this._shader.uniforms.uDraw.value = v
  }

  customProgramCacheKey() { return 'RevealMaterial_v2' }

  onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
    this._shader = shader
    shader.uniforms.uProgress = { value: this._uProgress }
    shader.uniforms.uDraw = { value: this._uDraw }

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */`#include <common>
      uniform float uProgress;
      uniform float uDraw;

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
      // 加载期"被画出来"：噪声擦除，从透明到线稿。与下面的上色擦除用不同的噪声相位，
      // 两者同时进行时不会沿同一条边界走
      if (uDraw < 0.999) {
        float drawNoise = revealNoise(vMapUv * 9.0 + vec2(3.7, 1.3));
        if (drawNoise > uDraw) discard;
      }
      if (uProgress > 0.001) {
        float rn = revealNoise(vMapUv * 15.0) * 0.15;
        float maskValue = (1.0 - vMapUv.y) + rn;
        if (maskValue < uProgress * 1.5) discard;
      }
      `
    )
  }
}

extend({ RevealMaterial })
export { RevealMaterial }

// JSX type declaration — R3F elements registered via extend() use this namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // revealMaterial is registered via extend({ RevealMaterial }) above
      revealMaterial: {
        ref?: React.Ref<{ uProgress: number; uDraw: number } | null>
        map?: THREE.Texture | null
        transparent?: boolean
        alphaTest?: number
        depthWrite?: boolean
        uProgress?: number
        uDraw?: number
      }
    }
  }
}
