import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CredentialsPageView } from '@/components/classic/CredentialsViews'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import { credentialsEn } from '@/lib/content/credentials'

/**
 * 证书卡片的图片裁切方式要跟着 `fit` 走（2026-09-06）。
 *
 * 卡片是 4:3 的框。横版证书塞进去只是略裁边；**竖版**证书（NECCS 1322×1871、
 * 交换证明 2128×3080、CET-6 747×890）用 `object-cover` 会被裁掉近一半——
 * 底部的印章和签名正好在被切掉的那一段。证书是文件，不是照片，
 * 裁一刀就毁了（同一天修 logo 时是同一课）。
 *
 * 数据里标 `fit: 'contain'` 的用 `object-contain` + 底板；没标的照旧 `object-cover`。
 * 哪些该标由 `credentialsAssets.test.ts` 从原图尺寸对账。
 */
describe('证书卡片的图片裁切', () => {
  it('标了 fit: contain 的卡用 object-contain，其余用 object-cover', () => {
    const { container } = render(<CredentialsPageView />, { wrapper: LocaleProvider })
    const items = [...credentialsEn.awards, ...credentialsEn.certificates]
    expect(items.some(i => i.fit === 'contain'), '数据里至少该有一张竖版').toBe(true)

    for (const item of items) {
      const img = container.querySelector(`img[src="${item.image}"]`)
      expect(img, `${item.id} 没渲染出图`).not.toBeNull()
      if (item.fit === 'contain') {
        expect(img!.className, `${item.id} 是竖版，该 contain`).toContain('object-contain')
        expect(img!.className).not.toContain('object-cover')
      } else {
        expect(img!.className, `${item.id} 是横版，该 cover`).toContain('object-cover')
      }
    }
  })
})
