import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import SmoothScrollProvider from '@/components/providers/SmoothScrollProvider'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
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
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <LocaleProvider>
          <SmoothScrollProvider>
            {children}
          </SmoothScrollProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
