# Phase 1: Entry Page + Classic Route + Gallery Door Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/` with a split-screen entry page (The Lab vs Classic), migrate current content to `/classic`, and add a CSS 3D gallery door section at the end of `/classic`.

**Architecture:** Three tasks in sequence. Task 1 migrates current `app/page.tsx` to `app/classic/page.tsx` with a Navbar variant that links back to `/`. Task 2 replaces `app/page.tsx` with the GSAP split-screen entry. Task 3 adds the CSS 3D gallery door as a new section component appended to `/classic`.

**Tech Stack:** Next.js 14 App Router, React 18, GSAP 3.14 (already installed), Tailwind CSS v4, TypeScript strict

## Global Constraints

- `output: 'export'` — static site, no server-side APIs or middleware
- `pnpm --filter @yibin/resume type-check` must pass (0 errors) after every task
- `pnpm --filter @yibin/resume build` must succeed after all tasks
- All new components use `'use client'` where they use hooks or browser APIs
- No new npm dependencies — use only what's already in `apps/resume/package.json` (gsap, framer-motion, react, next)
- Tailwind v4 utility classes + CSS variables (`var(--bg-base)` etc.) for theming
- No `document.querySelector` in React components — use `useRef`
- Ports 3000, 3001, 5173 must be freed after any dev server use

---

### Task 1: Migrate current `/` content to `/classic`

**Files:**
- Create: `apps/resume/app/classic/page.tsx`
- Create: `apps/resume/components/layout/ClassicNavbar.tsx`
- Modify: `apps/resume/app/page.tsx` (gut it — Task 2 will fill it)

**Interfaces:**
- Produces: route `/classic` rendering identical content to current `/`
- Produces: `ClassicNavbar` — same as `Navbar` but brand link goes to `/` (home) not `#top`

- [ ] **Step 1: Create `app/classic/page.tsx`**

Copy the current `app/page.tsx` content exactly:

```tsx
import { ClassicNavbar, Footer } from '@/components/layout'
import {
  HeroSection,
  AboutSection,
  SkillsSection,
  ExperienceSection,
  ProjectsSection,
  PublicationsSection,
  ContactSection,
} from '@/components/sections'

export default function ClassicPage() {
  return (
    <>
      <ClassicNavbar />
      <main>
        <HeroSection />
        <AboutSection />
        <SkillsSection />
        <ExperienceSection />
        <ProjectsSection />
        <PublicationsSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  )
}
```

Note: uses `ClassicNavbar` (not `Navbar`) — created in next step.

- [ ] **Step 2: Create `apps/resume/components/layout/ClassicNavbar.tsx`**

Copy `Navbar.tsx` exactly, with one change: the brand `<a>` goes to `/` (home) instead of `#top`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { LocaleToggle } from '@/components/ui'

export function ClassicNavbar() {
  const { locale } = useLocale()
  const c = content[locale].nav
  const [scrolled, setScrolled] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    setIsDark(!isLight)
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('resume-theme', next ? 'dark' : 'light')
  }

  return (
    <nav
      className="fixed top-0 w-full z-50 transition-all duration-300"
      style={
        scrolled
          ? { backdropFilter: 'blur(12px)', background: 'rgba(7,11,18,0.80)', borderBottom: '1px solid var(--bg-border)' }
          : { background: 'transparent' }
      }
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand — goes to / (entry page) */}
        <a
          href="/"
          className="font-display font-bold text-lg transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-primary)' }}
        >
          {c.brand}
        </a>

        <div className="hidden md:flex items-center gap-6">
          {c.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm transition-colors hover:text-[#00d4ff]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {link.label}
            </a>
          ))}
          <a href="/gallery" className="text-sm transition-colors hover:text-[#00d4ff]" style={{ color: 'var(--text-secondary)' }}>
            Gallery
          </a>
        </div>

        <div className="flex items-center gap-3">
          <LocaleToggle />
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-200 hover:border-[#00d4ff] hover:text-[#00d4ff]"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--bg-border)', color: 'var(--text-secondary)', fontSize: '1rem' }}
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Export ClassicNavbar from layout barrel**

Read `apps/resume/components/layout/index.ts` then add the export:

```typescript
export { ClassicNavbar } from './ClassicNavbar'
// keep all existing exports
```

- [ ] **Step 4: Stub out `app/page.tsx` temporarily**

Replace with a minimal placeholder (Task 2 will fill it properly):

```tsx
export default function EntryPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#070b12', color: '#f0f4ff', fontFamily: 'sans-serif' }}>
      Entry page coming soon
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_web
pnpm --filter @yibin/resume type-check 2>&1 | tail -5
```
Expected: clean (no output)

- [ ] **Step 6: Verify `/classic` route builds**

```bash
pnpm --filter @yibin/resume build 2>&1 | grep -E "classic|error|Error" | head -10
```
Expected: `○ /classic` in the route table, no errors

- [ ] **Step 7: Commit**

```bash
git add apps/resume/app/classic/ apps/resume/app/page.tsx apps/resume/components/layout/ClassicNavbar.tsx apps/resume/components/layout/index.ts
git commit -m "feat: migrate classic resume to /classic route, stub entry page

ClassicNavbar: brand links to / (entry) instead of #top.
/classic renders identical content to former /.
app/page.tsx stubbed for Task 2.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Entry page — split-screen The Lab vs Classic

**Files:**
- Modify: `apps/resume/app/page.tsx` (replace stub with full implementation)

**Interfaces:**
- Consumes: nothing from prior tasks beyond route existence
- Produces: `/` — full-screen split with GSAP hover expansion, links to `/lab` and `/classic`

- [ ] **Step 1: Write the full entry page**

Replace `apps/resume/app/page.tsx` entirely:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

export default function EntryPage() {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const left = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    // Entry animation — panels slide in from edges
    gsap.fromTo(left,
      { xPercent: -100, opacity: 0 },
      { xPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }
    )
    gsap.fromTo(right,
      { xPercent: 100, opacity: 0 },
      { xPercent: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }
    )

    // Hover expand handlers
    const expandLeft = () => {
      gsap.to(left,  { flexBasis: '68%', duration: 0.5, ease: 'power2.out' })
      gsap.to(right, { flexBasis: '32%', duration: 0.5, ease: 'power2.out' })
      gsap.to(left.querySelector('.panel-bg'),  { scale: 1.05, duration: 0.5, ease: 'power2.out' })
      gsap.to(right.querySelector('.panel-bg'), { scale: 1.0,  duration: 0.5, ease: 'power2.out' })
    }
    const expandRight = () => {
      gsap.to(right, { flexBasis: '68%', duration: 0.5, ease: 'power2.out' })
      gsap.to(left,  { flexBasis: '32%', duration: 0.5, ease: 'power2.out' })
      gsap.to(right.querySelector('.panel-bg'), { scale: 1.05, duration: 0.5, ease: 'power2.out' })
      gsap.to(left.querySelector('.panel-bg'),  { scale: 1.0,  duration: 0.5, ease: 'power2.out' })
    }
    const resetPanels = () => {
      gsap.to([left, right], { flexBasis: '50%', duration: 0.5, ease: 'power2.out' })
      gsap.to([left.querySelector('.panel-bg'), right.querySelector('.panel-bg')], { scale: 1.0, duration: 0.5, ease: 'power2.out' })
    }

    left.addEventListener('mouseenter', expandLeft)
    right.addEventListener('mouseenter', expandRight)
    left.addEventListener('mouseleave', resetPanels)
    right.addEventListener('mouseleave', resetPanels)

    return () => {
      left.removeEventListener('mouseenter', expandLeft)
      right.removeEventListener('mouseenter', expandRight)
      left.removeEventListener('mouseleave', resetPanels)
      right.removeEventListener('mouseleave', resetPanels)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#070b12',
        cursor: 'pointer',
      }}
    >
      {/* Left — The Lab */}
      <div
        ref={leftRef}
        onClick={() => router.push('/lab')}
        style={{ flexBasis: '50%', flexShrink: 0, position: 'relative', overflow: 'hidden' }}
      >
        <div
          className="panel-bg"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #0d1220 0%, #141926 40%, #0a0f1a 100%)',
            willChange: 'transform',
          }}
        />
        {/* Corridor depth lines — decorative */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
          {[0.2, 0.35, 0.5, 0.65, 0.8].map((x) => (
            <div key={x} style={{ position: 'absolute', left: `${x * 100}%`, top: 0, bottom: 0, width: '1px', background: 'linear-gradient(to bottom, transparent, #00d4ff, transparent)' }} />
          ))}
        </div>
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', padding: '40px' }}>
          <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', letterSpacing: '0.4em', color: 'rgba(0,212,255,0.6)', textTransform: 'uppercase' }}>
            Enter
          </p>
          <h1 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 700, color: '#f0f4ff', margin: 0, textAlign: 'center' }}>
            The Lab
          </h1>
          <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '13px', color: 'rgba(139,155,188,0.8)', letterSpacing: '0.15em', textAlign: 'center' }}>
            Immersive · 3D · Interactive
          </p>
          <div style={{ marginTop: '24px', width: '32px', height: '1px', background: 'linear-gradient(to right, #00d4ff, #6366f1)' }} />
        </div>
        {/* Arrow */}
        <div style={{ position: 'absolute', bottom: '40px', right: '40px', color: 'rgba(0,212,255,0.5)', fontSize: '24px' }}>→</div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', flexShrink: 0, zIndex: 20 }} />

      {/* Right — Classic */}
      <div
        ref={rightRef}
        onClick={() => router.push('/classic')}
        style={{ flexBasis: '50%', flexShrink: 0, position: 'relative', overflow: 'hidden' }}
      >
        <div
          className="panel-bg"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(225deg, #0d1220 0%, #0f1628 40%, #070b12 100%)',
            willChange: 'transform',
          }}
        />
        {/* Grid lines — decorative */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.06 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ position: 'absolute', left: `${(i / 7) * 100}%`, top: 0, bottom: 0, width: '1px', background: '#6366f1' }} />
          ))}
        </div>
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', padding: '40px' }}>
          <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', letterSpacing: '0.4em', color: 'rgba(99,102,241,0.6)', textTransform: 'uppercase' }}>
            View
          </p>
          <h1 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 700, color: '#f0f4ff', margin: 0, textAlign: 'center' }}>
            Classic
          </h1>
          <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '13px', color: 'rgba(139,155,188,0.8)', letterSpacing: '0.15em', textAlign: 'center' }}>
            Clean · Fast · Standard
          </p>
          <div style={{ marginTop: '24px', width: '32px', height: '1px', background: 'linear-gradient(to right, #6366f1, #8b5cf6)' }} />
        </div>
        {/* Arrow */}
        <div style={{ position: 'absolute', bottom: '40px', right: '40px', color: 'rgba(99,102,241,0.5)', fontSize: '24px' }}>→</div>
      </div>

      {/* Bottom credit */}
      <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: 'rgba(139,155,188,0.4)', letterSpacing: '0.2em', fontFamily: 'var(--font-mono, monospace)', zIndex: 30, pointerEvents: 'none' }}>
        resume.yibinfeng.com
      </div>
    </div>
  )
}
```

Note: uses `next/navigation` `useRouter` for client-side routing. `'use client'` at top.

- [ ] **Step 2: Type-check**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_web
pnpm --filter @yibin/resume type-check 2>&1 | tail -5
```
Expected: clean

- [ ] **Step 3: Build check**

```bash
pnpm --filter @yibin/resume build 2>&1 | grep -E "^\s+[○●]|error|Error" | head -15
```
Expected: `○ /`, `○ /classic`, `○ /gallery` all listed. No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/resume/app/page.tsx
git commit -m "feat: split-screen entry page at / — The Lab vs Classic

GSAP hover expand (50/50 → 68/32), entry slide animation,
decorative corridor lines (left) and grid lines (right).
Navigates to /lab and /classic on click.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Copy door textures + GalleryDoorSection

**Files:**
- Create: `apps/resume/public/textures/doors/` (copied from portfolio-itom)
- Create: `apps/resume/components/sections/GalleryDoorSection.tsx`
- Modify: `apps/resume/components/sections/index.ts` (add export)
- Modify: `apps/resume/app/classic/page.tsx` (add GalleryDoorSection after ContactSection)

**Interfaces:**
- Consumes: door texture files from `apps/resume/public/textures/doors/`
- Produces: `GalleryDoorSection` component — CSS 3D door, click navigates to `/gallery`

- [ ] **Step 1: Copy door textures from portfolio-itom**

```bash
mkdir -p /Users/tal/Desktop/Code/personal_yibin/yibin_web/apps/resume/public/textures/doors
cp /Users/tal/Desktop/Code/personal_yibin/portfolio-itom/public/textures/doors/door_left_painted.webp \
   /Users/tal/Desktop/Code/personal_yibin/portfolio-itom/public/textures/doors/door_right_painted.webp \
   /Users/tal/Desktop/Code/personal_yibin/portfolio-itom/public/textures/doors/handle_left_painted.webp \
   /Users/tal/Desktop/Code/personal_yibin/portfolio-itom/public/textures/doors/handle_right_painted.webp \
   /Users/tal/Desktop/Code/personal_yibin/portfolio-itom/public/textures/doors/pien.webp \
   /Users/tal/Desktop/Code/personal_yibin/yibin_web/apps/resume/public/textures/doors/

ls /Users/tal/Desktop/Code/personal_yibin/yibin_web/apps/resume/public/textures/doors/
```
Expected: 5 files listed

- [ ] **Step 2: Create `GalleryDoorSection.tsx`**

```tsx
'use client'

import { useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/hooks/useLocale'

export function GalleryDoorSection() {
  const router = useRouter()
  const { locale } = useLocale()
  const doorRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const isOpenRef = useRef(false)

  const openDoor = () => {
    if (isOpenRef.current) return
    isOpenRef.current = true
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return
    left.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
    right.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
    left.style.transform = 'rotateY(-75deg)'
    right.style.transform = 'rotateY(75deg)'
    setTimeout(() => router.push('/gallery'), 700)
  }

  const hoverOpen = () => {
    if (isOpenRef.current) return
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return
    left.style.transition = 'transform 0.4s ease'
    right.style.transition = 'transform 0.4s ease'
    left.style.transform = 'rotateY(-20deg)'
    right.style.transform = 'rotateY(20deg)'
  }

  const hoverClose = () => {
    if (isOpenRef.current) return
    const left = leftPanelRef.current
    const right = rightPanelRef.current
    if (!left || !right) return
    left.style.transition = 'transform 0.4s ease'
    right.style.transition = 'transform 0.4s ease'
    left.style.transform = 'rotateY(0deg)'
    right.style.transform = 'rotateY(0deg)'
  }

  const label = locale === 'zh' ? '画廊' : 'The Gallery'
  const sublabel = locale === 'zh' ? '摄影 · 2019–2024' : 'Photography · 2019–2024'

  return (
    <section
      id="gallery-door"
      className="relative z-10 w-full"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="py-24 px-6 max-w-6xl mx-auto flex flex-col items-center">
        {/* Section title */}
        <div className="mb-12 text-center">
          <p
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {locale === 'zh' ? '探索' : 'Explore'}
          </p>
          <h2
            className="font-display text-3xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {label}
          </h2>
          <div className="mt-2 h-px w-16 mx-auto bg-gradient-to-r from-[#c8a96e] to-[#8b6914]" />
        </div>

        {/* Door */}
        <div
          ref={doorRef}
          onClick={openDoor}
          onMouseEnter={hoverOpen}
          onMouseLeave={hoverClose}
          style={{
            cursor: 'pointer',
            perspective: '1200px',
            width: '280px',
            height: '420px',
            position: 'relative',
          }}
          role="button"
          aria-label={`Enter ${label}`}
        >
          {/* Door frame (pien — threshold piece) */}
          <div style={{
            position: 'absolute',
            inset: '-12px',
            borderRadius: '4px 4px 0 0',
            background: 'linear-gradient(135deg, #3d2b1a 0%, #5a3d25 40%, #2a1a0d 100%)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }} />

          {/* Door container — perspective origin */}
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
            {/* Left panel */}
            <div
              ref={leftPanelRef}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '50%',
                height: '100%',
                transformOrigin: 'left center',
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
              }}
            >
              <img
                src="/textures/doors/door_left_painted.webp"
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                draggable={false}
              />
              {/* Handle */}
              <img
                src="/textures/doors/handle_right_painted.webp"
                alt=""
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '24px',
                  height: '60px',
                  objectFit: 'contain',
                }}
                draggable={false}
              />
            </div>

            {/* Right panel */}
            <div
              ref={rightPanelRef}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: '50%',
                height: '100%',
                transformOrigin: 'right center',
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
              }}
            >
              <img
                src="/textures/doors/door_right_painted.webp"
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                draggable={false}
              />
              {/* Handle */}
              <img
                src="/textures/doors/handle_left_painted.webp"
                alt=""
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '24px',
                  height: '60px',
                  objectFit: 'contain',
                }}
                draggable={false}
              />
            </div>

            {/* Interior glow — visible when door opens */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center, rgba(245,230,163,0.4) 0%, rgba(200,169,110,0.1) 50%, transparent 70%)',
              pointerEvents: 'none',
            }} />
          </div>
        </div>

        {/* Label below door */}
        <div
          className="mt-6 text-center"
          style={{ fontFamily: 'var(--font-gallery, Georgia, serif)' }}
        >
          <p style={{ fontSize: '15px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
            {sublabel}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.1em' }}>
            {locale === 'zh' ? '点击进入' : 'Click to enter'}
          </p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Export from sections barrel**

Read `apps/resume/components/sections/index.ts` then add:

```typescript
export { GalleryDoorSection } from './GalleryDoorSection'
// keep all existing exports
```

- [ ] **Step 4: Add GalleryDoorSection to `/classic`**

Read `apps/resume/app/classic/page.tsx` then add import and usage after ContactSection:

```tsx
import {
  HeroSection,
  AboutSection,
  SkillsSection,
  ExperienceSection,
  ProjectsSection,
  PublicationsSection,
  ContactSection,
  GalleryDoorSection,  // add this
} from '@/components/sections'

// In JSX, after <ContactSection />:
<GalleryDoorSection />
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_web
pnpm --filter @yibin/resume type-check 2>&1 | tail -5
```
Expected: clean

- [ ] **Step 6: Build check**

```bash
pnpm --filter @yibin/resume build 2>&1 | grep -E "^\s+[○●]|error|Error" | head -15
```
Expected: `○ /`, `○ /classic`, `○ /gallery` all present, no errors

- [ ] **Step 7: Commit everything**

```bash
git add \
  apps/resume/public/textures/doors/ \
  apps/resume/components/sections/GalleryDoorSection.tsx \
  apps/resume/components/sections/index.ts \
  apps/resume/app/classic/page.tsx
git commit -m "feat: CSS 3D gallery door section in /classic

Door panels use itomdev painted textures (non-commercial personal use).
Hover: panels open 20deg. Click: fully open (75deg) then navigate /gallery.
CSS transform-style:preserve-3d, no R3F, keeps /classic lightweight.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Verification

- [ ] **Step 1: Start dev server**

```bash
cd /Users/tal/Desktop/Code/personal_yibin/yibin_web
pnpm --filter @yibin/resume dev &
sleep 10
```

- [ ] **Step 2: Check all routes return 200**

```bash
for path in "/" "/classic" "/gallery"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000${path}")
  echo "$path → $code"
done
```
Expected: all 200

- [ ] **Step 3: Check entry page has split-screen content**

```bash
curl -s http://localhost:3000/ | python3 -c "
import sys; html = sys.stdin.read()
print('Has The Lab:', 'The Lab' in html)
print('Has Classic:', 'Classic' in html)
print('Has /lab href:', '/lab' in html)
print('Has /classic href:', '/classic' in html)
"
```
Expected: all True

- [ ] **Step 4: Check classic has gallery door**

```bash
curl -s http://localhost:3000/classic | python3 -c "
import sys; html = sys.stdin.read()
print('Has gallery-door id:', 'gallery-door' in html)
print('Has door texture:', 'textures/doors' in html)
print('Has /gallery href:', '/gallery' in html)
"
```
Expected: all True

- [ ] **Step 5: Stop dev server and clean ports**

```bash
pkill -f "next dev -p 3000" 2>/dev/null || true
sleep 1
for port in 3000 3001 5173; do lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null; done
echo "ports cleared"
```

- [ ] **Step 6: Commit verification note**

```bash
git add /Users/tal/Desktop/Code/personal_yibin/yibin_web/.superpowers/sdd/progress.md 2>/dev/null || true
git commit --allow-empty -m "chore: Phase 1 verification passed — /, /classic, /gallery all 200

Co-Authored-By: Claude <noreply@anthropic.com>"
```
