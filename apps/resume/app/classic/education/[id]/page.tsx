import { Navbar, Footer } from '@/components/layout'
import { en } from '@/lib/content/en'
import { EducationDetailClient } from './EducationDetailClient'

export function generateStaticParams() {
  return en.education.items.map((edu) => ({ id: edu.id }))
}

export default async function EducationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <Navbar brandHref="/classic/" />
      <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <EducationDetailClient id={id} />
      </main>
      <Footer />
    </>
  )
}
