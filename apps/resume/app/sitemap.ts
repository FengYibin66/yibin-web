import type { MetadataRoute } from 'next'

/**
 * `output: 'export'` 下必须显式声明。
 *
 * 不声明时 Next 把这个 route 当成动态的，构建直接失败：
 * `export const dynamic = "force-static" ... not configured on route`。
 * 本应用没有运行时（ADR 20260822120803），所以"静态"是唯一可能的形态——
 * 这一行是把那个事实告诉 Next。
 */
export const dynamic = 'force-static'

/**
 * sitemap.xml（审计 E3）。
 *
 * 之前整站没有 sitemap 也没有 robots.txt，而入口页的两个出口都是
 * `div onClick`——爬虫既找不到 `/classic` 也找不到 `/lab`，等于只有首页被
 * 收录。入口页现在是真链接了，sitemap 是另一半。
 *
 * `output: 'export'` 下这个函数在构建期执行，产出静态的 `sitemap.xml`
 * （ADR 20260822120803：本应用没有运行时，所以任何"动态 sitemap"都不成立）。
 */

const BASE = 'https://resume.yibinfeng.com'

/**
 * 构建时间作为 lastModified。
 *
 * 不用 `new Date()` 的运行时含义——静态导出里它就是构建时刻，语义正好对：
 * 内容随构建产出，构建时间就是内容时间。
 */
const BUILT_AT = new Date()

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: BUILT_AT,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      // 简历正文：对招聘方与搜索引擎都是最有价值的一页
      url: `${BASE}/classic`,
      lastModified: BUILT_AT,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE}/lab`,
      lastModified: BUILT_AT,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/gallery`,
      lastModified: BUILT_AT,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ]
}
