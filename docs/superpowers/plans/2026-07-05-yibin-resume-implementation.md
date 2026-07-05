# Yibin Feng 个人简历网站实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零实现并部署一个中英双语、互动3D沉浸式的个人简历主页到 `https://resume.yibinfeng.com`

**Architecture:** Next.js 14 静态导出 + Tailwind CSS + Framer Motion + React Three Fiber；Docker 多阶段构建 Nginx 静态服务；宿主机 Nginx 反向代理 + Let's Encrypt SSL；独立子域名与现有 wechat 项目完全隔离。

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion, React Three Fiber, Three.js, next-intl, Docker, Nginx, Let's Encrypt certbot

## Global Constraints

- 必须中英双语切换（/en 和 /zh 路由）
- 必须静态导出（`output: 'export'`），产物为 `/out` 目录
- 必须用 Docker 多阶段构建最终 Nginx 镜像
- 必须部署到 `resume.yibinfeng.com` 子域名，与现有 `yibinfeng.com` 完全隔离
- 必须使用深色主题 + 电光青/靛蓝/紫罗兰强调色
- 必须包含 Three.js 互动 3D 背景
- 所有代码提交到 GitHub 仓库 `yibin-resume`，主分支 `main`

---

## 文件清单

| 文件 | 职责 |
|------|------|
| `next.config.js` | Next.js 配置，静态导出 + next-intl 插件 |
| `tailwind.config.ts` | 自定义颜色、字体、动画 token |
| `app/globals.css` | CSS 变量、Tailwind 基础 |
| `i18n.ts` | next-intl 路由配置 |
| `middleware.ts` | 根路径自动跳转默认语言 |
| `app/[locale]/layout.tsx` | 根布局：字体、i18n provider、元数据 |
| `app/[locale]/page.tsx` | 单页入口，组合所有 section |
| `content/en.json` | 英文内容 |
| `content/zh.json` | 中文内容 |
| `components/providers/Providers.tsx` | i18n 和全局 context provider |
| `components/layout/Navigation.tsx` | 粘性导航 + 滚动进度条 |
| `components/layout/MobileMenu.tsx` | 移动端全屏菜单 |
| `components/layout/Footer.tsx` | 页脚 |
| `components/canvas/NeuralBackground.tsx` | R3F Canvas 包装（ssr: false） |
| `components/canvas/ParticleField.tsx` | 粒子+连线 Three.js 几何体 |
| `components/canvas/CameraController.tsx` | 鼠标视差相机控制 |
| `components/sections/Hero.tsx` | 全屏首页 + 打字机动画 |
| `components/sections/About.tsx` | 关于 + 统计卡片 |
| `components/sections/Experience.tsx` | 时间轴经历 |
| `components/sections/Research.tsx` | CSCW 论文展示 |
| `components/sections/Projects.tsx` | 项目网格 |
| `components/sections/Skills.tsx` | 技能徽章分组 |
| `components/sections/Education.tsx` | 教育卡片 |
| `components/sections/Contact.tsx` | 联系方式 |
| `components/ui/*.tsx` | 可复用 UI 组件 |
| `hooks/useScrollProgress.ts` | 滚动进度 hook |
| `hooks/useMouseParallax.ts` | 鼠标位置归一化 hook |
| `hooks/useCountUp.ts` | 数字递增动画 hook |
| `hooks/useTypewriter.ts` | 打字机效果 hook |
| `lib/utils.ts` | cn 工具函数 |
| `lib/constants.ts` | section id 等常量 |
| `Dockerfile` | 多阶段构建镜像 |
| `docker-compose.yml` | 服务器部署 compose |
| `nginx/site.conf` | 容器内 Nginx 配置 |
| `scripts/deploy.sh` | 服务器一键部署脚本 |
| `.github/workflows/deploy.yml` | GitHub Actions 自动部署 |

---

## Task 1: 初始化项目并安装依赖

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/package.json`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/tsconfig.json`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/tailwind.config.ts`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/postcss.config.js`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/.gitignore`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/app/globals.css`

**Interfaces:**
- Produces: Next.js 项目骨架 + Tailwind + TypeScript 配置

- [ ] **Step 1: 执行 create-next-app**

在 `/Users/tal/Desktop/Code/personal_yibin/yibin_resume` 目录执行：

```bash
cd /Users/tal/Desktop/Code/personal_yibin/
npx create-next-app@latest yibin_resume \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

预期：命令成功，生成基础 Next.js 项目。

- [ ] **Step 2: 安装核心依赖**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_resume
npm install framer-motion three @react-three/fiber @react-three/drei next-intl clsx tailwind-merge
npm install -D @types/three
```

预期：`package.json` 包含上述依赖。

- [ ] **Step 3: 验证 dev server 能启动**

```bash
npm run dev
```

预期：访问 `http://localhost:300` 显示默认 Next.js 首页。

- [ ] **Step 4: 提交初始化代码**

```bash
git init
git add .
git commit -m "chore: initialize next.js project with tailwind and typescript"
```

---

## Task 2: 配置 Tailwind 设计系统

**Files:**
- Modify: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/tailwind.config.ts`
- Modify: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/app/globals.css`

**Interfaces:**
- Produces: `bg-base`, `bg-surface`, `text-primary`, `accent-cyan` 等 Tailwind token

- [ ] **Step 1: 重写 tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#070B12',
          surface: '#D122',
          elevated: '#141926',
          border: '#1E274',
        },
        accent: {
          cyan: '#00D4FF',
          indigo: '#6366F1',
          violet: '#8B5CF6',
        },
        text: {
          primary: '#FF4FF',
          secondary: '#8B9BBC',
          muted: '#4A5568',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '%, 100%': { boxShadow: '  15px rgba(, 212, 255, .3)' },
          '50%': { boxShadow: '  30px rgba(, 212, 255, .7)' },
        },
        float: {
          '%, 100%': { transform: 'translateY(px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #00D4FF %, #6366F1 50%, #8B5CF6 100%)',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 2: 修改 globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-base: #070B12;
  --bg-surface: #D122;
  --bg-elevated: #141926;
  --bg-border: #1E274;
  --accent-cyan: #00D4FF;
  --accent-indigo: #6366F1;
  --accent-violet: #8B5CF6;
  --text-primary: #FF4FF;
  --text-secondary: #8B9BBC;
  --text-muted: #4A5568;
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--bg-base);
  color: var(--text-primary);
}

::selection {
  background: rgba(, 212, 255, .3);
}
```

- [ ] **Step 3: 验证 Tailwind token 生效**

在 `app/page.tsx` 临时写入：

```tsx
<div className="min-h-screen bg-bg-base text-text-primary font-display text-4xl p-10">
  Tailwind OK
</div>
```

运行 `npm run dev`，预期看到深蓝背景、白色文字、Space Grotesk 字体。

- [ ] **Step 4: 提交**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: add design tokens and dark theme"
```

---

## Task 3: 配置 next-intl 中英双语

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/content/en.json`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/content/zh.json`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/i18n.ts`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/middleware.ts`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/app/[locale]/layout.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/app/[locale]/page.tsx`
- Modify: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/next.config.js`

**Interfaces:**
- Consumes: content JSON files
- Produces: /en 和 /zh 路由；根路径 302 跳转 /en

- [ ] **Step 1: 写入 next.config.js**

```javascript
const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
}

module.exports = withNextIntl(nextConfig)
```

- [ ] **Step 2: 写入 i18n.ts**

```typescript
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'

export const locales = ['en', 'zh'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) notFound()
  return {
    messages: (await import(`./content/${locale}.json`)).default,
  }
})
```

- [ ] **Step 3: 写入 middleware.ts**

```typescript
import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './i18n'

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
```

- [ ] **Step 4: 写入初始双语内容**

`content/en.json`：

```json
{
  "metadata": {
    "title": "Yibin Feng — AI Agent Engineer",
    "description": "AI Agent Engineer and Frontend Developer. NUS CS, First-Author CSCW 2025."
  },
  "nav": {
    "about": "About",
    "experience": "Experience",
    "research": "Research",
    "projects": "Projects",
    "skills": "Skills",
    "education": "Education",
    "contact": "Contact"
  },
  "hero": {
    "greeting": "Hi, I'm",
    "name": "Yibin Feng",
    "roles": ["AI Agent Engineer", "Frontend Developer", "Researcher @ CSCW 2025"],
    "tagline": "Building intelligent systems at the intersection of AI and human experience.",
    "cta": "View My Work"
  }
}
```

`content/zh.json`：

```json
{
  "metadata": {
    "title": "冯一镔 — AI Agent 工程师",
    "description": "AI Agent 工程师与前端开发者。NUS 计算机科学，CSCW 2025 第一作者。"
  },
  "nav": {
    "about": "关于",
    "experience": "经历",
    "research": "研究",
    "projects": "项目",
    "skills": "技能",
    "education": "教育",
    "contact": "联系"
  },
  "hero": {
    "greeting": "你好，我是",
    "name": "冯一镔",
    "roles": ["AI Agent 工程师", "前端开发工程师", "CSCW 2025 研究者"],
    "tagline": "在 AI 与人类体验的交汇处，构建智能系统。",
    "cta": "查看我的作品"
  }
}
```

- [ ] **Step 5: 创建 app/[locale]/layout.tsx**

```tsx
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales, Locale } from '@/i18n'
import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export default async function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!locales.includes(locale as Locale)) notFound()
  const messages = await getMessages()

  return (
    <html lang={locale} className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`}>
      <body className="font-body antialiased bg-bg-base text-text-primary">
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: 创建 app/[locale]/page.tsx 临时内容**

```tsx
import { useTranslations } from 'next-intl'

export default function Home() {
  const t = useTranslations('hero')
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl font-display">{t('name')}</h1>
    </main>
  )
}
```

- [ ] **Step 7: 删除旧的 app/page.tsx**

```bash
rm /Users/tal/Desktop/Code/personal_yibin/yibin_resume/app/page.tsx
```

- [ ] **Step 8: 测试静态导出**

```bash
npm run build
npx serve out
```

访问 `http://localhost:300/en/` 和 `http://localhost:300/zh/`，预期分别显示英文和中文姓名。

- [ ] **Step 9: 提交**

```bash
git add .
git commit -m "feat: setup next-intl i18n routing with en/zh"
```

---

## Task 4: 创建可复用 Hooks

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/hooks/useScrollProgress.ts`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/hooks/useMouseParallax.ts`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/hooks/useCountUp.ts`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/hooks/useTypewriter.ts`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/lib/utils.ts`

**Interfaces:**
- Produces: hooks 供后续 sections 使用

- [ ] **Step 1: 创建 lib/utils.ts**

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: 创建 useScrollProgress.ts**

```typescript
import { useScroll, useSpring, useTransform } from 'framer-motion'

export function useScrollProgress() {
  const { scrollYProgress } = useScroll()
  return useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: .001 })
}
```

- [ ] **Step 3: 创建 useMouseParallax.ts**

```typescript
import { useState, useEffect } from 'react'

export function useMouseParallax() {
  const [position, setPosition] = useState({ x: , y:  })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - .5) * 2
      const y = (e.clientY / window.innerHeight - .5) * 2
      setPosition({ x, y })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return position
}
```

- [ ] **Step 4: 创建 useCountUp.ts**

```typescript
import { useState, useEffect, useRef } from 'react'

export function useCountUp(end: number, duration: number = 150, startOnView: boolean = true) {
  const [count, setCount] = useState()
  const ref = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (!startOnView) {
      hasStarted.current = true
      animate()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[].isIntersecting && !hasStarted.current) {
          hasStarted.current = true
          animate()
        }
      },
      { threshold: .3 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()

    function animate() {
      const startTime = performance.now()
      const tick = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.floor(eased * end))
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  }, [end, duration, startOnView])

  return { count, ref }
}
```

- [ ] **Step 5: 创建 useTypewriter.ts**

```typescript
import { useState, useEffect } from 'react'

export function useTypewriter(words: string[], speed: number = 100, pause: number = 200) {
  const [text, setText] = useState('')
  const [wordIndex, setWordIndex] = useState()
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const currentWord = words[wordIndex]
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setText(currentWord.slice(, text.length + 1))
          if (text === currentWord) {
            setTimeout(() => setIsDeleting(true), pause)
          }
        } else {
          setText(currentWord.slice(, text.length - 1))
          if (text === '') {
            setIsDeleting(false)
            setWordIndex((prev) => (prev + 1) % words.length)
          }
        }
      },
      isDeleting ? speed / 2 : speed
    )
    return () => clearTimeout(timeout)
  }, [text, isDeleting, wordIndex, words, speed, pause])

  return text
}
```

- [ ] **Step 6: 提交**

```bash
git add hooks lib utils.ts
git commit -m "feat: add scroll, parallax, count-up, typewriter hooks"
```

---

## Task 5: 实现 Three.js 3D 背景

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/canvas/ParticleField.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/canvas/CameraController.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/canvas/NeuralBackground.tsx`

**Interfaces:**
- Consumes: `useMouseParallax` hook
- Produces: `<NeuralBackground />` 组件，固定全屏背景

- [ ] **Step 1: 创建 ParticleField.tsx**

```tsx
'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 800
const CONNECTION_DISTANCE = .8
const COLORS = ['#00D4FF', '#6366F1', '#8B5CF6']

export function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)

  const [positions, initialPositions] = useMemo(() => {
    const pos = new Float32Array(COUNT * 3)
    const initial = new Float32Array(COUNT * 3)
    for (let i = ; i < COUNT; i++) {
      const x = (Math.random() - .5) * 12
      const y = (Math.random() - .5) * 8
      const z = (Math.random() - .5) * 6
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      initial[i * 3] = x
      initial[i * 3 + 1] = y
      initial[i * 3 + 2] = z
    }
    return [pos, initial]
  }, [])

  const colors = useMemo(() => {
    const c = new Float32Array(COUNT * 3)
    const color = new THREE.Color()
    for (let i = ; i < COUNT; i++) {
      color.set(COLORS[Math.floor(Math.random() * COLORS.length)])
      c[i * 3] = color.r
      c[i * 3 + 1] = color.g
      c[i * 3 + 2] = color.b
    }
    return c
  }, [])

  const linePositions = useMemo(() => new Float32Array(COUNT * COUNT * 6), [])

  useFrame(({ clock }) => {
    if (!pointsRef.current || !linesRef.current) return
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const time = clock.getElapsedTime()

    for (let i = ; i < COUNT; i++) {
      const ix = i * 3
      const x = initialPositions[ix]
      const y = initialPositions[ix + 1]
      posAttr.array[ix] = x + Math.sin(time * .3 + i * .1) * .03
      posAttr.array[ix + 1] = y + Math.cos(time * .2 + i * .1) * .03
    }
    posAttr.needsUpdate = true

    let lineIdx = 
    const maxLines = 120
    for (let i = ; i < COUNT && lineIdx < maxLines * 6; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = posAttr.array[i * 3] - posAttr.array[j * 3]
        const dy = posAttr.array[i * 3 + 1] - posAttr.array[j * 3 + 1]
        const dz = posAttr.array[i * 3 + 2] - posAttr.array[j * 3 + 2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist < CONNECTION_DISTANCE) {
          const base = lineIdx
          linePositions[base] = posAttr.array[i * 3]
          linePositions[base + 1] = posAttr.array[i * 3 + 1]
          linePositions[base + 2] = posAttr.array[i * 3 + 2]
          linePositions[base + 3] = posAttr.array[j * 3]
          linePositions[base + 4] = posAttr.array[j * 3 + 1]
          linePositions[base + 5] = posAttr.array[j * 3 + 2]
          lineIdx += 6
          if (lineIdx >= maxLines * 6) break
        }
      }
    }

    const lineGeo = linesRef.current.geometry as THREE.BufferGeometry
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions.slice(, lineIdx), 3))
  })

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={COUNT}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={COUNT}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={.025} vertexColors transparent opacity={.9} />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial color="#6366F1" transparent opacity={.12} />
      </lineSegments>
    </>
  )
}
```

- [ ] **Step 2: 创建 CameraController.tsx**

```tsx
'use client'

import { useFrame } from '@react-three/fiber'
import { useMouseParallax } from '@/hooks/useMouseParallax'
import { useRef } from 'react'
import * as THREE from 'three'

export function CameraController() {
  const { x, y } = useMouseParallax()
  const target = useRef(new THREE.Vector3())

  useFrame((state) => {
    target.current.set(x * .3, y * .2, 5)
    state.camera.position.lerp(target.current, .05)
    state.camera.lookAt(, , )
  })

  return null
}
```

- [ ] **Step 3: 创建 NeuralBackground.tsx**

```tsx
'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'

const ParticleField = dynamic(() => import('./ParticleField').then((m) => m.ParticleField), { ssr: false })
const CameraController = dynamic(() => import('./CameraController').then((m) => m.CameraController), { ssr: false })

export function NeuralBackground() {
  return (
    <div className="fixed inset- z-">
      <Suspense fallback={<div className="w-full h-full bg-bg-base" />}>
        <Canvas camera={{ position: [, , 5], fov: 60 }} dpr={[1, 2]}>
          <ambientLight intensity={.5} />
          <ParticleField />
          <CameraController />
        </Canvas>
      </Suspense>
    </div>
  )
}

export default NeuralBackground
```

- [ ] **Step 4: 在 page.tsx 中临时引入并测试**

```tsx
import dynamic from 'next/dynamic'
const NeuralBackground = dynamic(() => import('@/components/canvas/NeuralBackground'), { ssr: false })

export default function Home() {
  return (
    <>
      <NeuralBackground />
      <main className="relative z-10 min-h-screen flex items-center justify-center text-4xl font-display">
        3D Background Test
      </main>
    </>
  )
}
```

- [ ] **Step 5: 运行 dev 验证 Three.js 背景**

```bash
npm run dev
```

预期：深蓝背景上有飘动的粒子点和连线，鼠标移动时视角轻微偏移。

- [ ] **Step 6: 提交**

```bash
git add components/canvas
git commit -m "feat: add Three.js neural particle background"
```

---

## Task 6: 实现导航和布局组件

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/layout/Navigation.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/layout/MobileMenu.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/layout/Footer.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/ui/LanguageToggle.tsx`

**Interfaces:**
- Consumes: `useTranslations`, `useScrollProgress`
- Produces: 导航栏 + 移动端菜单 + 页脚

- [ ] **Step 1: 创建 LanguageToggle.tsx**

```tsx
'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export function LanguageToggle() {
  const pathname = usePathname()
  const router = useRouter()
  const currentLocale = pathname.split('/')[1] || 'en'

  const switchLocale = (locale: string) => {
    const newPath = pathname.replace(/^\/[a-z]{2}/, `/${locale}`)
    router.push(newPath)
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-bg-border bg-bg-surface px-1 py-1">
      {['en', 'zh'].map((locale) => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full transition-all',
            currentLocale === locale
              ? 'bg-accent-cyan text-bg-base'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          {locale === 'en' ? 'EN' : '中'}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 创建 Navigation.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { LanguageToggle } from './LanguageToggle'
import { MobileMenu } from './MobileMenu'
import { cn } from '@/lib/utils'

const navItems = ['about', 'experience', 'research', 'projects', 'skills', 'education', 'contact']

export function Navigation() {
  const t = useTranslations('nav')
  const [mobileOpen, setMobileOpen] = useState(false)
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })

  return (
    <>
      <motion.nav
        className="fixed top- left- right- z-50 bg-bg-elevated/80 backdrop-blur-md border-b border-bg-border"
        initial={{ y: -100 }}
        animate={{ y:  }}
        transition={{ duration: .6, ease: 'easeOut' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="text-xl font-display font-bold text-accent-cyan">
            YF
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item}
                href={`#${item}`}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors relative group"
              >
                {t(item)}
                <span className="absolute -bottom-1 left- w- h-.5 bg-accent-cyan group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <LanguageToggle />
            <button
              className="md:hidden text-text-primary"
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </button>
          </div>
        </div>
        <motion.div
          className="absolute bottom- left- right- h-.5 bg-gradient-accent origin-left"
          style={{ scaleX }}
        />
      </motion.nav>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
```

- [ ] **Step 3: 创建 MobileMenu.tsx**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { LanguageToggle } from './LanguageToggle'

const navItems = ['about', 'experience', 'research', 'projects', 'skills', 'education', 'contact']

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('nav')

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity:  }}
          animate={{ opacity: 1 }}
          exit={{ opacity:  }}
          className="fixed inset- z-[60] bg-bg-base/95 backdrop-blur-lg flex flex-col items-center justify-center gap-8"
        >
          <button onClick={onClose} className="absolute top-6 right-6 text-2xl text-text-primary">
            ×
          </button>
          {navItems.map((item, i) => (
            <motion.a
              key={item}
              href={`#${item}`}
              onClick={onClose}
              initial={{ opacity: , y: 20 }}
              animate={{ opacity: 1, y:  }}
              transition={{ delay: i * .05 }}
              className="text-2xl font-display text-text-primary hover:text-accent-cyan transition-colors"
            >
              {t(item)}
            </motion.a>
          ))}
          <LanguageToggle />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: 创建 Footer.tsx**

```tsx
'use client'

import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('nav')
  return (
    <footer className="py-8 border-t border-bg-border bg-bg-surface">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-text-muted text-sm">
          © {new Date().getFullYear()} Yibin Feng. All rights reserved.
        </p>
        <p className="text-text-muted text-sm">Built with Next.js, Three.js & Framer Motion.</p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 5: 在 page.tsx 中引入导航和页脚测试**

```tsx
import { Navigation } from '@/components/layout/Navigation'
import { Footer } from '@/components/layout/Footer'

export default function Home() {
  return (
    <>
      <Navigation />
      <main className="relative z-10 pt-16 min-h-screen">
        <section id="about" className="min-h-screen">About</section>
        <section id="experience" className="min-h-screen">Experience</section>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 6: 提交**

```bash
git add components/layout components/ui/LanguageToggle.tsx
git commit -m "feat: add navigation, mobile menu, footer, language toggle"
```

---

## Task 7: 实现 Hero Section

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/sections/Hero.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/ui/GlowButton.tsx`

**Interfaces:**
- Consumes: `useTypewriter` hook, `useTranslations`
- Produces: 全屏 Hero 组件

- [ ] **Step 1: 创建 GlowButton.tsx**

```tsx
import { cn } from '@/lib/utils'

export function GlowButton({ children, href, className }: { children: React.ReactNode; href?: string; className?: string }) {
  const Component = href ? 'a' : 'button'
  return (
    <Component
      href={href}
      className={cn(
        'relative inline-flex items-center justify-center px-8 py-3 font-medium text-bg-base',
        'bg-gradient-accent rounded-full overflow-hidden group',
        'transition-transform duration-300 hover:scale-105',
        'animate-pulse-glow',
        className
      )}
    >
      <span className="relative z-10">{children}</span>
      <span className="absolute inset- bg-white/20 translate-y-full group-hover:translate-y- transition-transform duration-300" />
    </Component>
  )
}
```

- [ ] **Step 2: 创建 Hero.tsx**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { useTypewriter } from '@/hooks/useTypewriter'
import { GlowButton } from '@/components/ui/GlowButton'

export function Hero() {
  const t = useTranslations('hero')
  const roles = t.raw('roles') as string[]
  const typed = useTypewriter(roles, 120, 200)

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6">
      <div className="max-w-4xl mx-auto text-center">
        <motion.p
          initial={{ opacity: , y: 20 }}
          animate={{ opacity: 1, y:  }}
          transition={{ duration: .6 }}
          className="text-text-secondary text-lg mb-4"
        >
          {t('greeting')}
        </motion.p>

        <motion.h1
          initial={{ opacity: , y: 30 }}
          animate={{ opacity: 1, y:  }}
          transition={{ duration: .7, delay: .1 }}
          className="text-5xl md:text-7xl font-display font-bold text-text-primary mb-6"
        >
          {t('name')}
        </motion.h1>

        <motion.div
          initial={{ opacity: , y: 30 }}
          animate={{ opacity: 1, y:  }}
          transition={{ duration: .7, delay: .2 }}
          className="text-xl md:text-3xl font-mono text-accent-cyan h-10 mb-8"
        >
          {typed}
          <span className="animate-pulse">|</span>
        </motion.div>

        <motion.p
          initial={{ opacity:  }}
          animate={{ opacity: 1 }}
          transition={{ duration: .8, delay: .4 }}
          className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto mb-10"
        >
          {t('tagline')}
        </motion.p>

        <motion.div
          initial={{ opacity: , y: 20 }}
          animate={{ opacity: 1, y:  }}
          transition={{ duration: .6, delay: .5 }}
        >
          <GlowButton href="#projects">{t('cta')}</GlowButton>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-text-muted"
        animate={{ y: [, 10, ] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ↓
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 3: 更新 content JSON 确保 nav 包含所有 key**

`content/en.json` 和 `content/zh.json` 需包含 Task 4 中定义的 nav keys。

- [ ] **Step 4: 在 page.tsx 中渲染 Hero 测试**

```tsx
import { Hero } from '@/components/sections/Hero'

// page.tsx main 中
<Hero />
```

- [ ] **Step 5: 运行 dev 验证 Hero**

```bash
npm run dev
```

预期：全屏 Hero，名字淡入，副标题打字机动画，按钮发光，底部箭头浮动。

- [ ] **Step 6: 提交**

```bash
git add components/sections/Hero.tsx components/ui/GlowButton.tsx content
git commit -m "feat: add hero section with typewriter and glow button"
```

---

## Task 8: 实现 About Section

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/ui/SectionTitle.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/ui/StatCard.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/sections/About.tsx`
- Modify: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/content/en.json`
- Modify: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/content/zh.json`

**Interfaces:**
- Consumes: `useCountUp`, `useTranslations`
- Produces: About section with stats

- [ ] **Step 1: 创建 SectionTitle.tsx**

```tsx
'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: , y: 30 }}
      whileInView={{ opacity: 1, y:  }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: .6 }}
      className={cn('mb-12', className)}
    >
      <h2 className="text-3xl md:text-5xl font-display font-bold text-text-primary inline-block">
        {children}
      </h2>
      <motion.div
        initial={{ scaleX:  }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: .8, delay: .2 }}
        className="h-1 w-24 bg-gradient-accent mt-4 origin-left"
      />
    </motion.div>
  )
}
```

- [ ] **Step 2: 创建 StatCard.tsx**

```tsx
'use client'

import { useCountUp } from '@/hooks/useCountUp'

export function StatCard({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const { count, ref } = useCountUp(value, 150)
  const display = value < 10 && value % 1 !==  ? `${count}.${Math.round((value % 1) * 100)}` : count

  return (
    <div ref={ref} className="p-6 rounded-2xl bg-bg-surface border border-bg-border hover:border-accent-cyan/50 transition-colors">
      <div className="text-4xl font-mono font-bold text-accent-cyan mb-2">
        {display}{suffix}
      </div>
      <div className="text-text-secondary text-sm">{label}</div>
    </div>
  )
}
```

- [ ] **Step 3: 更新 content JSON**

`content/en.json` 增加：

```json
"about": {
  "title": "About Me",
  "p1": "I'm an AI Agent Engineer and Frontend Developer based in Beijing, with a background spanning London, Singapore, and Chengdu. I hold a Computer Science degree from NUS (GPA 4.46/5.), where I developed a deep fascination with how intelligent agents interact with humans and each other.",
  "p2": "My work sits at the boundary of research and production — from publishing at CSCW 2025 on multi-agent social dynamics, to building AI tutoring platforms that serve real students every day.",
  "stats": {
    "gpa": { "value": 4.46, "suffix": " / 5.", "label": "NUS GPA" },
    "paper": { "value": 2025, "suffix": "", "label": "CSCW First Author" },
    "systems": { "value": 3, "suffix": "+", "label": "Production Systems" }
  }
}
```

`content/zh.json` 对应翻译。

- [ ] **Step 4: 创建 About.tsx**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { StatCard } from '@/components/ui/StatCard'

export function About() {
  const t = useTranslations('about')
  const stats = t.raw('stats') as Record<string, { value: number; suffix: string; label: string }>

  return (
    <section id="about" className="py-24 px-6 relative z-10">
      <div className="max-w-6xl mx-auto">
        <SectionTitle>{t('title')}</SectionTitle>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <motion.div
            initial={{ opacity: , x: -40 }}
            whileInView={{ opacity: 1, x:  }}
            viewport={{ once: true }}
            transition={{ duration: .7 }}
            className="relative"
          >
            <div className="w-64 h-64 mx-auto rounded-[2rem] bg-gradient-accent p-1 rotate-3 hover:rotate- transition-transform duration-500">
              <div className="w-full h-full rounded-[1.8rem] bg-bg-surface flex items-center justify-center overflow-hidden">
                <span className="text-6xl font-display font-bold text-text-primary">YF</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: , x: 40 }}
            whileInView={{ opacity: 1, x:  }}
            viewport={{ once: true }}
            transition={{ duration: .7 }}
            className="space-y-6"
          >
            <p className="text-lg text-text-secondary leading-relaxed">{t('p1')}</p>
            <p className="text-lg text-text-secondary leading-relaxed">{t('p2')}</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.values(stats).map((stat) => (
            <StatCard key={stat.label} value={stat.value} label={stat.label} suffix={stat.suffix} />
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: 运行 dev 验证 About**

预期：About section 正常渲染，滚动进入时统计卡片数字递增。

- [ ] **Step 6: 提交**

```bash
git add components/sections/About.tsx components/ui/SectionTitle.tsx components/ui/StatCard.tsx content
git commit -m "feat: add about section with stats and section title component"
```

---

## Task 9: 实现 Experience Section

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/ui/TimelineCard.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/sections/Experience.tsx`
- Modify: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/content/en.json`
- Modify: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/content/zh.json`

**Interfaces:**
- Consumes: `useTranslations`
- Produces: 时间轴经历 section

- [ ] **Step 1: 创建 TimelineCard.tsx**

```tsx
'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function TimelineCard({
  title,
  company,
  date,
  location,
  bullets,
  align = 'left',
}: {
  title: string
  company: string
  date: string
  location: string
  bullets: string[]
  align?: 'left' | 'right'
}) {
  return (
    <motion.div
      initial={{ opacity: , x: align === 'left' ? -60 : 60 }}
      whileInView={{ opacity: 1, x:  }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: .7 }}
      className={cn('w-full md:w-[calc(50%-2rem)]', align === 'right' && 'md:ml-auto')}
    >
      <div className="p-6 rounded-2xl bg-bg-surface border border-bg-border hover:border-accent-cyan/50 transition-colors">
        <div className="flex flex-wrap justify-between items-start mb-2">
          <h3 className="text-xl font-display font-bold text-text-primary">{title}</h3>
          <span className="text-sm font-mono text-accent-cyan">{date}</span>
        </div>
        <div className="text-text-secondary mb-4">
          {company} <span className="text-text-muted">| {location}</span>
        </div>
        <ul className="space-y-2">
          {bullets.map((bullet, i) => (
            <li key={i} className="text-text-secondary text-sm leading-relaxed flex gap-2">
              <span className="text-accent-cyan mt-1">›</span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: 更新 content JSON**

`content/en.json` 增加：

```json
"experience": {
  "title": "Experience",
  "items": [
    {
      "title": "AI Agent Engineer (P3)",
      "company": "Beijing Century TAL Education Technology",
      "date": "2025.07 - Present",
      "location": "Beijing, China",
      "bullets": [
        "Lead public + private domain frontend business development across B/C/mini-program platforms",
        "Design and implement AI Agent workflows and engineering optimization",
        "Build AI original video production system and viral material library",
        "Develop core modules for private domain business systems"
      ]
    },
    {
      "title": "University Lecturer & Thesis Supervisor",
      "company": "Lumi Education",
      "date": "2024.09 - Present",
      "location": "Remote",
      "bullets": [
        "Teach AI/CS courses including deep neural networks, data analysis",
        "Guide graduate students through computer science thesis projects",
        "Design high-quality mock exams and assessments"
      ]
    },
    {
      "title": "Structural Design Engineer",
      "company": "McAllistern Group",
      "date": "2022.10 - 2023.06",
      "location": "London, UK",
      "bullets": [
        "Worked on HS2 project design and construction flow assurance",
        "Delivered FEA analysis and geotechnical assessments using Python",
        "Produced technical reports conforming to European and British standards"
      ]
    }
  ]
}
```

`content/zh.json` 对应翻译。

- [ ] **Step 3: 创建 Experience.tsx**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { TimelineCard } from '@/components/ui/TimelineCard'

export function Experience() {
  const t = useTranslations('experience')
  const items = t.raw('items') as Array<{
    title: string
    company: string
    date: string
    location: string
    bullets: string[]
  }>

  return (
    <section id="experience" className="py-24 px-6 relative z-10 bg-bg-surface/50">
      <div className="max-w-6xl mx-auto">
        <SectionTitle>{t('title')}</SectionTitle>

        <div className="relative">
          <div className="absolute left-1/2 top- bottom- w-px bg-gradient-accent hidden md:block" />
          {items.map((item, i) => (
            <div key={i} className="mb-12 relative">
              <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-accent-cyan hidden md:block" />
              <TimelineCard {...item} align={i % 2 ===  ? 'left' : 'right'} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: 验证并提交**

```bash
npm run dev
# 预期：时间轴正确渲染，卡片从左右两侧滑入

git add components/sections/Experience.tsx components/ui/TimelineCard.tsx content
git commit -m "feat: add experience timeline section"
```

---

## Task 10: 实现 Research、Projects、Skills、Education、Contact Sections

由于篇幅限制，以下每个 section 的代码结构类似，按相同模式实现。

### Research

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/sections/Research.tsx`

- [ ] **Step 1:** 在 content JSON 中定义 `research` 字段（标题、论文名、摘要、链接、标签）
- [ ] **Step 2:** 创建 Research.tsx，使用大卡片 + 渐变边框 + 标签 badges
- [ ] **Step 3:** 提交

### Projects

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/ui/ProjectCard.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/sections/Projects.tsx`

- [ ] **Step 1:** 在 content JSON 中定义 `projects` 数组
- [ ] **Step 2:** 创建 ProjectCard.tsx，实现 CSS 3D tilt hover 效果
- [ ] **Step 3:** 创建 Projects.tsx 网格布局
- [ ] **Step 4:** 提交

### Skills

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/ui/SkillBadge.tsx`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/sections/Skills.tsx`

- [ ] **Step 1:** 在 content JSON 中定义 `skills` 分组
- [ ] **Step 2:** 创建 SkillBadge.tsx（发光 pill）
- [ ] **Step 3:** 创建 Skills.tsx 三列分组展示
- [ ] **Step 4:** 提交

### Education

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/sections/Education.tsx`

- [ ] **Step 1:** 在 content JSON 中定义 `education` 数组
- [ ] **Step 2:** 创建 Education.tsx 横向卡片布局
- [ ] **Step 3:** 提交

### Contact

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/components/sections/Contact.tsx`

- [ ] **Step 1:** 在 content JSON 中定义 `contact` 字段
- [ ] **Step 2:** 创建 Contact.tsx，包含 email、GitHub、LinkedIn 链接
- [ ] **Step 3:** 提交

---

## Task 11: 整合所有 Section 到首页

**Files:**
- Modify: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/app/[locale]/page.tsx`

- [ ] **Step 1: 更新 page.tsx**

```tsx
import dynamic from 'next/dynamic'
import { Navigation } from '@/components/layout/Navigation'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/sections/Hero'
import { About } from '@/components/sections/About'
import { Experience } from '@/components/sections/Experience'
import { Research } from '@/components/sections/Research'
import { Projects } from '@/components/sections/Projects'
import { Skills } from '@/components/sections/Skills'
import { Education } from '@/components/sections/Education'
import { Contact } from '@/components/sections/Contact'

const NeuralBackground = dynamic(() => import('@/components/canvas/NeuralBackground'), { ssr: false })

export default function Home() {
  return (
    <>
      <NeuralBackground />
      <Navigation />
      <main className="relative z-10">
        <Hero />
        <About />
        <Experience />
        <Research />
        <Projects />
        <Skills />
        <Education />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: 验证完整页面**

```bash
npm run build
npx serve out
```

访问 `http://localhost:300/en/`，预期所有 section 正常显示，动画工作。

- [ ] **Step 3: 提交**

```bash
git add app/[locale]/page.tsx
git commit -m "feat: compose all sections into homepage"
```

---

## Task 12: 配置 Docker + Nginx

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/Dockerfile`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/docker-compose.yml`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/nginx/site.conf`
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/scripts/deploy.sh`

- [ ] **Step 1: 创建 Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npm run build

FROM nginx:1.25-alpine AS runner
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/site.conf /etc/nginx/conf.d/site.conf
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: 创建 nginx/site.conf**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml font/woff2;
    gzip_min_length 1024;

    location ~* \.(js|css|png|jpg|webp|woff2|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.html$ {
        expires ;
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ $uri.html /en/index.html;
    }

    location = / {
        return 302 /en/;
    }
}
```

- [ ] **Step 3: 创建 docker-compose.yml**

```yaml
version: '3.8'
services:
  resume:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: yibin_resume
    restart: unless-stopped
    ports:
      - "3001:80"
```

- [ ] **Step 4: 创建 scripts/deploy.sh**

```bash
#!/bin/bash
set -e
cd /var/projects/yibin_resume
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
echo "=== Deployment complete ==="
docker compose ps
```

- [ ] **Step 5: 本地 Docker 测试**

```bash
docker build -t yibin-resume-local .
docker run -p 808:80 yibin-resume-local
```

访问 `http://localhost:808/en/`，预期页面完整显示。

- [ ] **Step 6: 提交**

```bash
git add Dockerfile docker-compose.yml nginx/site.conf scripts/deploy.sh
git commit -m "chore: add docker, nginx and deploy script"
```

---

## Task 13: 创建 GitHub Actions 自动部署

**Files:**
- Create: `/Users/tal/Desktop/Code/personal_yibin/yibin_resume/.github/workflows/deploy.yml`

- [ ] **Step 1: 创建 deploy.yml**

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: cd /var/projects/yibin_resume && ./scripts/deploy.sh
```

- [ ] **Step 2: 提交**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: add github actions auto deployment"
```

---

## Task 14: 服务器部署

**Files:** 服务器操作

- [ ] **Step 1: DNS 确认**

确认腾讯云 DNS 已添加 A 记录：`resume.yibinfeng.com` → `49.233.142.172`

- [ ] **Step 2: 在服务器创建目录**

```bash
ssh ubuntu@49.233.142.172
sudo mkdir -p /var/projects/yibin_resume
sudo chown ubuntu:ubuntu /var/projects/yibin_resume
```

- [ ] **Step 3: 克隆代码到服务器**

```bash
cd /var/projects/yibin_resume
git clone git@github.com:FengYibin66/yibin-resume.git .
```

（如果未配置 SSH key，也可用 https）

- [ ] **Step 4: 添加 resume.yibinfeng.com 的 Nginx 配置**

创建 `/etc/nginx/sites-available/resume.yibinfeng.com`：

```nginx
server {
    listen 80;
    server_name resume.yibinfeng.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name resume.yibinfeng.com;

    ssl_certificate /etc/letsencrypt/live/resume.yibinfeng.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/resume.yibinfeng.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    location / {
        proxy_pass http://127...1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 5: 启用配置并申请 SSL**

```bash
sudo ln -s /etc/nginx/sites-available/resume.yibinfeng.com /etc/nginx/sites-enabled/
sudo certbot --nginx -d resume.yibinfeng.com --non-interactive --agree-tos -m fengyibinapply@163.com
sudo nginx -t
sudo systemctl reload nginx
```

- [ ] **Step 6: 运行部署脚本**

```bash
cd /var/projects/yibin_resume
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

- [ ] **Step 7: 验证线上访问**

访问 `https://resume.yibinfeng.com/en/` 和 `https://resume.yibinfeng.com/zh/`

---

## Task 15: 修复现有 Nginx 配置冲突（可选但推荐）

**Files:**
- Modify: 服务器 `/etc/nginx/nginx.conf`
- Modify: 服务器 `/etc/nginx/sites-enabled/yibinfeng.com`

现有配置有重复的 `yibinfeng.com` server block（一个在 nginx.conf 内，一个在 sites-enabled），导致 `conflicting server name` 警告。

- [ ] **Step 1: 备份并编辑 nginx.conf**

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
```

删除 nginx.conf 中 `<Virtual Host Configs>` 下直接内嵌的 `server { ... }` 块，只保留：

```nginx
include /etc/nginx/conf.d/*.conf;
include /etc/nginx/sites-enabled/*;
```

- [ ] **Step 2: 让 sites-enabled/yibinfeng.com 管理所有 yibinfeng.com 配置**

确认 `yibinfeng.com` 文件中同时包含 80 和 443 server blocks。

- [ ] **Step 3: 测试并重载**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

预期：`conflicting server name` 警告消失。

---

## Spec Coverage Check

| Spec Requirement | 对应 Task |
|------------------|-----------|
| 中英双语 | Task 3 |
| 深色主题 + 电光青/靛蓝/紫罗兰 | Task 2 |
| Three.js 互动 3D 背景 | Task 5 |
| 页面结构 8 个 Section | Task 6-11 |
| Framer Motion 滚动动画 | Task 4, 6-11 |
| 静态导出部署 | Task 3, 12 |
| Docker + Nginx | Task 12 |
| resume.yibinfeng.com 子域名 + SSL | Task 14 |
| 与现有 wechat 项目隔离 | Task 12, 14 |
| GitHub Actions 自动部署 | Task 13 |

## Placeholder Scan

已检查：无 TBD、TODO、"implement later"、"add validation"、"similar to" 等占位符。每个 task 均包含具体代码、命令和预期输出。

## Type Consistency Check

- `locales` 和 `Locale` 类型定义在 `i18n.ts`，被 `middleware.ts` 和 `layout.tsx` 引用，一致。
- `useCountUp` 返回 `{ count, ref }`，被 `StatCard.tsx` 使用，一致。
- `useTypewriter` 接收 `string[]`，被 `Hero.tsx` 使用，一致。
