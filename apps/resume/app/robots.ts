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
 * robots.txt（审计 E3）。
 *
 * 全站开放抓取——这是一个作品集，被搜索引擎收录是它的目的。只有 Next 的
 * 构建产物目录不必爬（`/_next/` 下是 chunk 与静态资源，收录它们没有意义，
 * 还会稀释权重）。
 *
 * `output: 'export'` 下构建期产出静态 `robots.txt`。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/_next/',
    },
    sitemap: 'https://resume.yibinfeng.com/sitemap.xml',
  }
}
