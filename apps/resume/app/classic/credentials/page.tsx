'use client'

import { CredentialsPageView } from '@/components/classic/CredentialsViews'
import { Navbar, Footer } from '@/components/layout'

export default function CredentialsPage() {
  return (
    <>
      <Navbar brandHref="/classic/" />
      <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <CredentialsPageView />
      </main>
      <Footer />
    </>
  )
}
