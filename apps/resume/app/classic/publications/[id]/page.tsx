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
    <>
      <Navbar brandHref="/classic/" />
      <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <PublicationDetailClient id={id} />
      </main>
      <Footer />
    </>
  )
}
