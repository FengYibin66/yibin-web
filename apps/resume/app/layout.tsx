import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Space_Grotesk, Inter, JetBrains_Mono, Cormorant_Garamond } from 'next/font/google'
import './globals.css'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import SmoothScrollProvider from '@/components/providers/SmoothScrollProvider'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  preload: false,
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: false,
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
})

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-gallery',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Yibin Feng — AI Engineer & Researcher',
  description: 'Personal portfolio of Yibin Feng, AI Engineer and Researcher. First author at CSCW 2025. MSc from NUS and Imperial College London.',
  openGraph: {
    title: 'Yibin Feng — AI Engineer & Researcher',
    description: 'Personal portfolio of Yibin Feng, AI Engineer and Researcher.',
    type: 'website',
    url: 'https://resume.yibinfeng.com',
  },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${cormorantGaramond.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Inline script: reads localStorage before first paint to set data-theme.
            Runs synchronously in <head> — no FOUC, no hydration mismatch. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('resume-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light')})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <LocaleProvider>
          <SmoothScrollProvider>
            {children}
          </SmoothScrollProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
