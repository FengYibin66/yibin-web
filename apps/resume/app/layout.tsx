import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import localFont from 'next/font/local'
import './globals.css'
// Lenis 官方基础样式（html.lenis 高度、lenis-stopped 的 overflow 等）。此前从未引入
import 'lenis/dist/lenis.css'
import { LocaleProvider } from '@/components/providers/LocaleProvider'
import SmoothScrollProvider from '@/components/providers/SmoothScrollProvider'

// 四款界面字体从 @fontsource 包自托管，不用 next/font/google（ADR 20260909163155）。
//
// 原因：构建机在大陆，Google 不可达；曾经用 NEXT_FONT_GOOGLE_MOCKED_RESPONSES 让构建
// 「过」，结果 Next 把 mock 里的 https://fonts.gstatic.com/... 地址原样写成字体文件，
// 线上每个 woff2 都是 89 字节的 URL 字符串，四款字体自那时起从未生效。
//
// 只引 latin 文件——等价于原先的 subsets: ['latin']（@fontsource 已按 unicode-range
// 拆成 latin / latin-ext）。路径穿过 node_modules 是刻意的：字体版本由 pnpm-lock 锁定，
// 许可全文随包里的 LICENSE 装船；这四个包必须是本包的**直接**依赖，pnpm 的严格
// node_modules 下 next/font/local 的相对路径才解析得到。
// e2e/staticExport.spec.ts 断言产物里每个 woff2 以 wOF2 魔数开头。
const spaceGrotesk = localFont({
  src: '../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2',
  weight: '300 700',
  variable: '--font-display',
  display: 'swap',
  preload: false,
})

const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-sans',
  display: 'swap',
  preload: false,
})

const jetbrainsMono = localFont({
  src: '../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--font-mono',
  display: 'swap',
  preload: false,
})

const cormorantGaramond = localFont({
  src: [
    { path: '../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
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
