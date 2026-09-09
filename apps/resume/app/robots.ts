import type { MetadataRoute } from 'next'

/** `output: 'export'` 下必须显式声明，否则 Next 当它是动态 route、构建失败 */
export const dynamic = 'force-static'

/** robots.txt（审计 E3）。全站开放抓取；`/_next/` 下是 chunk，收录它只稀释权重 */
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
