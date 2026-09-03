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
        {/*
          无 JS 时让入场动画的起始态可见。

          framer-motion 的 `initial={{opacity:0, y:20}}` 在 SSR 阶段会被写成内联样式
          `opacity:0;transform:translateY(20px)`；没有 JS 时动画永不启动，于是
          hero 区（自我介绍、职位、简述）在静态 HTML 里**存在但完全透明**——
          人眼看到的是一片空白。而 Playwright 的 toBeVisible() 不看 opacity，
          于是「禁用 JS 时内容可读」的 E2E 曾一直绿着，掩盖了这个真实缺陷。

          内联样式只能用 !important 覆盖。这里刻意用属性选择器精确匹配
          `opacity:0`（不匹配 `opacity:0.7` 这类正常半透明样式），
          避免误伤有意隐藏的元素。有 JS 时 <noscript> 不生效，动画照常。
        */}
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html: [
                '[style*="opacity:0;"],[style*="opacity:0"]:not([style*="opacity:0."]){',
                'opacity:1!important;transform:none!important;',
                '}',
              ].join(''),
            }}
          />
        </noscript>
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
