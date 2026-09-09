/**
 * 浏览器自身的噪声——**只有明确列在这里的**才被 `pageerror` 夹具豁免。
 */

/**
 * 导航把在途的 RSC 请求打断时 WebKit 报的那一条。原文形如
 * `/…/classic/index.txt?_rsc=… due to access control checks.`
 *
 * `index.txt` 是 Next App Router 自己的 RSC 载荷，请求由它的客户端路由发出。
 * 当帧导航（`goBack()`、点链接）中止在途的 fetch，WebKit 把这种中止报成
 * 「access control checks」（同源却报访问控制，正是它的措辞）；Next 随后退回
 * 整页导航，页面照常工作。
 *
 * **不是某一个 spec 的事**：它是浏览器行为，任何会触发客户端导航的用例都可能
 * 撞上。第一版只加在 `classicReveal.spec.ts` 里，随后 `lab.spec.ts` 的语言切换
 * 用例就在 `/gallery/index.txt` 上撞到同一条。
 *
 * 正则钉住 `index.txt?_rsc=` 与那句固定结尾，**其他页面异常照旧让用例红**。
 * 这一点要紧：`pageerror` 夹具当年是为了抓相机所有权断言的首帧假阳性才加的。
 * 范围由 `__tests__/browserNoise.test.ts` 守着。
 */
export const ABORTED_RSC_FETCH = /index\.txt\?_rsc=\S* due to access control checks\.$/

/** 判断一条 `pageerror` 是否属于已登记的浏览器噪声 */
export function isKnownBrowserNoise(message: string): boolean {
  return ABORTED_RSC_FETCH.test(message)
}
