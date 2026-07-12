import { Navbar, Footer } from '@/components/layout'
import { en } from '@/lib/content/en'
import { ExperienceDetailClient } from './ExperienceDetailClient'

export function generateStaticParams() {
  return en.experience.items.map((item) => ({ id: item.id }))
}

export default async function ExperienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <Navbar brandHref="/classic/" />
      <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <ExperienceDetailClient id={id} />
      </main>
      <Footer />
    </>
  )
}
