import { Navbar, Footer } from '@/components/layout'
import { en } from '@/lib/content/en'
import { PublicationDetailClient } from './PublicationDetailClient'

export function generateStaticParams() {
  return en.publications.items.map((item) => ({ id: item.id }))
}

export default async function PublicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
        min-h-dvh + flex-col + main flex-1：短页面时 Footer 贴视口底，不必为了看到它
        再滚一屏。原先是 `<main className="min-h-screen">`——100vh 把 main 强撑到满屏，
        而内容只有约 500px，于是「内容 → 341px 空白 → Footer」，还得多滚 105px
        才看到 Footer（实测 2026-09-09 epic 页：文档 949px / 视口 844px / 内容 503px）。
        用 dvh 而非 vh：iOS 地址栏收起会改变 vh，dvh 跟着变。
      */}
      <Navbar brandHref="/classic/" />
      <main className="flex-1" style={{ background: 'var(--bg-base)' }}>
        <PublicationDetailClient id={id} />
      </main>
      <Footer />
    </div>
  )
}
