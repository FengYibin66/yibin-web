import { describe, expect, it } from 'vitest'

import { isKnownBrowserNoise } from '../e2e/helpers/browserNoise'

/**
 * 守住 `pageerror` 夹具豁免的**范围**。
 *
 * 一条豁免腐烂的典型路径是被逐步放宽（下次红了就多加一个 `.*`），
 * 而放宽之后**没有任何症状**——只会让夹具越来越不抓东西。
 * 这道夹具当年是为了抓相机所有权断言的首帧假阳性才加的。
 */
describe('浏览器噪声的豁免范围', () => {
  it('命中 CI 上实际出现的那两条原文', () => {
    for (const real of [
      '/127.0.0.1:4321/classic/index.txt?_rsc=8k3n6AfebTMiPh9T due to access control checks.',
      '/127.0.0.1:4321/gallery/index.txt?_rsc=fpdHabVlXfzJACF4 due to access control checks.',
    ]) {
      expect(isKnownBrowserNoise(real), real).toBe(true)
    }
  })

  it('不放过别的异常', () => {
    for (const other of [
      'ReferenceError: x is not defined',
      'Could not load /textures/foo.webp',
      "TypeError: undefined is not an object (evaluating 'a.b')",
      // 同一个 URL 但别的失败原因
      '/127.0.0.1:4321/classic/index.txt?_rsc=abc something else',
      // 别的资源被同样的原因中止
      '/127.0.0.1:4321/textures/x.webp due to access control checks.',
      // 相机所有权断言（这道夹具存在的原因，绝不能被放过）
      'CameraRig: 相机在导演持有期间被别人写过',
    ]) {
      expect(isKnownBrowserNoise(other), `不该被豁免：${other}`).toBe(false)
    }
  })
})
